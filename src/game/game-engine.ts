import { Scenario } from '../simulator/scenarios/Scenarios';
import { Simulator } from '../simulator/Simulator';
import { NextTurnState, PlayerActions, VictoryState, isNextTurn, Indicators } from '../simulator/SimulatorState';
import { RecordedInGameEventChoice } from '../simulator/in-game-events/InGameEvents';
import { createGameUI } from './createGameUI';
import { CapabilityImprovements, ContainmentPolicy } from '../simulator/player-actions/PlayerActions';
import { setControlsToTurn, showWinScreen, updateIndicators } from './setGameUI';
import { months } from '../lib/util';

interface CurrentUISelection {
    transit: boolean;
    masks: boolean;
    schools: boolean;
    business: boolean;
}

type AvailableActions = 'transit' | 'masks' | 'schools' | 'business';

export class GameEngine {
    private scenario: Scenario;
    private simulator: Simulator;
    private currentlySelectedActions: CurrentUISelection;
    private playerTurn: number;

    constructor(scenario: Scenario) {
        this.scenario = scenario;
        this.simulator = new Simulator(scenario);
        this.playerTurn = 0;
        this.currentlySelectedActions = {
            transit: false,
            masks: false,
            schools: false,
            business: false
        };
    }

    start() {
        const onPlayerSelectsAction = (action: AvailableActions) => {
            this.currentlySelectedActions[action] = !this.currentlySelectedActions[action];
        };

        const onEndTurn = () => {
            let nextTurn: NextTurnState | VictoryState;
            const month = months[this.playerTurn % months.length];
            this.playerTurn += 1;
            const playerActions = this.collectPlayerActions();
            nextTurn = this.simulator.nextTurn(playerActions, month.numDays);
            this.onNextTurn(nextTurn);
        };

        const onRestart = () => {
            // Quick and dirty restart
            window.location.reload();
        };

        const initialState = this.simulator.state();
        createGameUI(this.scenario.initialContainmentPolicies, onPlayerSelectsAction, onEndTurn, onRestart);
        setControlsToTurn(0, this.scenario.initialContainmentPolicies);
        updateIndicators(initialState.history);
    }

    private undoLastTurn() {
        if (this.playerTurn > 0) {
            this.simulator = this.simulator.reset(this.playerTurn - 1);
            const lastState = this.simulator.state();
            this.currentlySelectedActions = {
                transit: false,
                masks: false,
                schools: false,
                business: false
            }

            setControlsToTurn(this.playerTurn - 1, this.currentlySelectedActions);
            updateIndicators(lastState.history);
        }
    }

    private onNextTurn(nextTurn: NextTurnState | VictoryState) {
        const simulatorState = this.simulator.state();
        if (isNextTurn(nextTurn)) {
            // Just another turn. Update the controls and indicators
            setControlsToTurn(this.playerTurn, this.currentlySelectedActions);
            updateIndicators(simulatorState.history);
        } else {
            // Do the final graph update
            updateIndicators(simulatorState.history);

            // Show the win screen
            const totalCasesReducer = (acc: number, it: Indicators) => acc + it.numInfected;
            const totalCases = simulatorState.history.reduce(totalCasesReducer, 0);
            const totalCostReducer = (acc: number, it: Indicators) => acc + it.totalCost;
            const totalCost = simulatorState.history.reduce(totalCostReducer, 0);
            showWinScreen(totalCost, totalCases);
        }
    }

    private collectPlayerActions(): PlayerActions {
        const result = {
            containmentPolicies: [] as ContainmentPolicy[],
            capabilityImprovements: [] as CapabilityImprovements[],
            inGameEventChoices: [] as RecordedInGameEventChoice[]
        };

        for (let k in this.currentlySelectedActions) {
            if (this.currentlySelectedActions[k as AvailableActions]) {
                const containmentPolicy = this.scenario.initialContainmentPolicies.find((cp) => cp.id === k);
                if (containmentPolicy) {
                    result.containmentPolicies.push(containmentPolicy);
                }
            }
        }

        return result;
    }
}
