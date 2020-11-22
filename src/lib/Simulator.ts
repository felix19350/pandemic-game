import { CapabilityImprovements, ContainmentPolicy } from './PlayerActions';
import { RandomEvent } from './RandomEvents';
import { NexTurnState, PlayerActions, SimulatorState, VictoryState, WorldState } from './SimulatorState';
import { FakeNegativeBinomial } from './Probabilities';
import { Scenario } from './Scenarios';
import { VictoryCondition } from './VictoryConditon';

export class Simulator {
    private scenario: Scenario;
    private scaleFactor: number;
    private daysPerTurn: number;
    private currentState: WorldState;
    private history: WorldState[];

    constructor(initialState: Scenario, daysPerTurn = 10) {
        this.scenario = initialState;
        this.daysPerTurn = daysPerTurn;
        this.scaleFactor = initialState.gdpPerDay * 0.2;
        this.currentState = this.computeInitialWorldState();
        this.history = [];
    }

    /**
     * Allows the caller to obtain a snapshot of the current simulator state.
     */
    state(): SimulatorState {
        const simulatorStateSnapshot: SimulatorState = {
            initialState: this.scenario,
            currentState: this.currentState,
            history: this.history
        };
        // Return an immutable copy of the state.
        return this.clone(simulatorStateSnapshot);
    }

    /**
     * Processes the next turn by computing the effects of player actions, random events and the natural
     * progression of the epidemic.
     */
    nextTurn(actionsInTurn: PlayerActions): NexTurnState | VictoryState {
        const nextTurn = this.prepareNextTurn(actionsInTurn);
        const victoryCondition = this.isVictorious();
        if (victoryCondition) {
            this.computeVictory(victoryCondition);
        } else {
            return nextTurn;
        }
    }

    private prepareNextTurn(actionsInTurn: PlayerActions): NexTurnState {
        // TODO: add guards to guarantee that player actions and capability improvements match the expectations.
        // Assumption: The frontend returns ALL the player actions that are enabled and that should be factored in.
        // Create a new copy of the current state to avoid side effects that can pollute the history
        const nextStateCandidate = this.clone(this.currentState);

        // Factor in the recurring effects of player actions.
        for (const containmentPolicy of actionsInTurn.containmentPolicies) {
            nextStateCandidate.indicators = containmentPolicy.recurringEffect(nextStateCandidate);
        }

        for (const capabilityImprovement of actionsInTurn.capabilityImprovements) {
            nextStateCandidate.indicators = capabilityImprovement.recurringEffect(nextStateCandidate);
        }

        // Factor in any new player actions and random events.
        const newPlayerActions: ContainmentPolicy[] = this.findNewContainmentPolicies(
            actionsInTurn.containmentPolicies
        );
        for (const containmentPolicy of newPlayerActions) {
            nextStateCandidate.indicators = containmentPolicy.immediateEffect(nextStateCandidate);
        }

        const newCapabilities: CapabilityImprovements[] = this.findNewCapabilities(
            actionsInTurn.capabilityImprovements
        );
        for (const capability of newCapabilities) {
            actionsInTurn;
            nextStateCandidate.indicators = capability.immediateEffect(nextStateCandidate);
        }

        // Add any new random events that happen
        const newRandomEvents = this.pickRandomEvents(nextStateCandidate);
        for (const randomEvent of newRandomEvents) {
            nextStateCandidate.indicators = randomEvent.immediateEffect(nextStateCandidate);
        }

        // Save the candidate state as the new current state
        this.commitState(this.computeNextWorldState(nextStateCandidate), actionsInTurn, newRandomEvents);

        return this.clone({
            newRandomEvents: newRandomEvents,
            currentState: this.currentState
        });
    }

    private isVictorious(): VictoryCondition | undefined {
        const simulatorState = this.state();
        return this.scenario.victoryConditions.find((it) => it.isMet(simulatorState));
    }

    private computeVictory(victoryCondition: VictoryCondition): VictoryState {
        return {
            simulatorState: this.state(),
            score: this.currentState.indicators.totalCost,
            victoryCondition: victoryCondition
        };
    }

    private computeNextWorldState(candidateState: WorldState): WorldState {
        let action_r = candidateState.indicators.r ** this.daysPerTurn; // compounding effect of a repeated action
        const last_result = this.currentState;
        const prev_cases = last_result.indicators.numInfected;

        // Don't allow cases to exceed hospital capacity
        const hospitalCapacity = this.currentState.indicators.hospitalCapacity;
        const lockdown_ratio = hospitalCapacity / prev_cases;
        const capped_action_r = prev_cases * action_r >= hospitalCapacity ? lockdown_ratio : action_r;
        action_r = capped_action_r;

        // Compute next state
        let new_num_infected = this.generateNewCasesFromDistribution(prev_cases, action_r);
        new_num_infected = Math.max(Math.floor(new_num_infected), 0);
        new_num_infected = Math.min(new_num_infected, this.scenario.totalPopulation);
        // Deaths from infections started 20 days ago

        const lag = Math.floor(20 / this.daysPerTurn); // how many steps, of `days` length each, need to have passed?
        const long_enough = this.history.length > lag;
        const mortality = this.scenario.mortality;
        const new_deaths_lagging = long_enough
            ? this.history[this.history.length - lag].indicators.numInfected * mortality
            : 0;

        const currentDay = last_result.days + this.daysPerTurn;
        return {
            days: currentDay,
            indicators: {
                numDead: new_deaths_lagging,
                numInfected: new_num_infected,
                totalPopulation: this.scenario.totalPopulation,
                hospitalCapacity: this.scenario.hospitalCapacity,
                r: this.scenario.r0,
                importedCasesPerDay: this.scenario.importedCasesPerDay,
                deathCosts: this.computeDeathCost(new_deaths_lagging),
                economicCosts: this.computeEconomicCosts(action_r, currentDay),
                medicalCosts: this.computeHospitalizationCosts(new_num_infected),
                totalCost: this.computeTotalCosts(new_num_infected, new_deaths_lagging, action_r, currentDay)
            },
            playerActions: {
                capabilityImprovements: [],
                containmentPolicies: []
            },
            randomEvents: []
        };
    }

    private computeInitialWorldState(): WorldState {
        // TODO: The hospitalization costs will not be zero on the first turn!
        return {
            days: 0,
            indicators: {
                numDead: 0,
                numInfected: this.scenario.initialNumInfected,
                totalPopulation: this.scenario.totalPopulation,
                hospitalCapacity: this.scenario.hospitalCapacity,
                r: this.scenario.r0,
                importedCasesPerDay: this.scenario.importedCasesPerDay,
                deathCosts: this.computeDeathCost(0),
                economicCosts: this.computeEconomicCosts(this.scenario.r0, 0),
                medicalCosts: this.computeHospitalizationCosts(this.scenario.initialNumInfected),
                totalCost: this.computeTotalCosts(this.scenario.initialNumInfected, 0, this.scenario.r0, 0)
            },
            playerActions: {
                capabilityImprovements: [],
                containmentPolicies: []
            },
            randomEvents: []
        };
    }

    private computeDeathCost(numDead: number): number {
        const cost_per_death = 1e7; // https://www.npr.org/transcripts/835571843: value of a statistical life
        return numDead * cost_per_death;
    }

    private computeHospitalizationCosts(numInfected: number): number {
        const hospitalization_rate = 0.1; // 10% of those infected will require hospitalization
        const num_hospitalizations = numInfected * hospitalization_rate;
        const cost_per_hospitalization = 50000; // $50,000 per hospital visit -- average amount billed to insurance (can dig up this reference if needed; it was on this order of magnitude)

        return num_hospitalizations * cost_per_hospitalization;
    }

    private computeEconomicCosts(r: number, days: number): number {
        if (r >= this.scenario.r0) {
            return 0;
        }
        return ((this.scaleFactor * (this.scenario.r0 ** 10 - r ** 10)) / this.scenario.r0 ** 10) * days;
    }

    private computeTotalCosts(numInfected: number, numDead: number, r: number, days: number): number {
        return (
            this.computeHospitalizationCosts(numInfected) +
            this.computeEconomicCosts(r, days) +
            this.computeDeathCost(numDead)
        );
    }

    private generateNewCasesFromDistribution(num_infected: number, action_r: number) {
        const lam = this.generateNewCases(num_infected, action_r);
        const r = 50.0;
        const p = lam / (r + lam);
        const new_num_infected = new FakeNegativeBinomial(r, p).sample();
        return new_num_infected;
    }

    private generateNewCases(num_infected: number, r: number) {
        const fraction_susceptible = 1; // immune population?
        const expected_new_cases =
            num_infected * r * fraction_susceptible + this.currentState.indicators.importedCasesPerDay;
        return expected_new_cases;
    }

    private findNewContainmentPolicies(containmentPoliciesOfTurn: ContainmentPolicy[]): ContainmentPolicy[] {
        const previousPolicies = this.currentState.playerActions.containmentPolicies.map((it) => it.name);
        return containmentPoliciesOfTurn.filter(
            (containmentPolicy) => previousPolicies.indexOf(containmentPolicy.name) != -1
        );
    }

    private findNewCapabilities(capabilityImprovementsInTurn: CapabilityImprovements[]): CapabilityImprovements[] {
        const previousPolicies = this.currentState.playerActions.capabilityImprovements.map((it) => it.name);
        return capabilityImprovementsInTurn.filter(
            (capabilityImprovement) => previousPolicies.indexOf(capabilityImprovement.name) != -1
        );
    }

    private pickRandomEvents(simulatorState: WorldState): RandomEvent[] {
        const eventsThatHappened = simulatorState.randomEvents.map((it) => it.name);
        return this.scenario.randomEvents.filter((it) => {
            const canOnlyHappenOnceButHasntHappened = it.happensOnce && it.name in eventsThatHappened;
            return (
                it.minDaysBeforeAppear > simulatorState.days && // Event can appear
                (!it.happensOnce || canOnlyHappenOnceButHasntHappened) && // Event can happen multiple times or it hasn't happened yet
                Math.random() <= it.probability
            ); // The probability of the event happening
        });
    }

    private commitState(nextStateCandidate: WorldState, actionsInTurn: PlayerActions, newRandomEvents: RandomEvent[]) {
        // Update the actions and random events.
        nextStateCandidate.playerActions = actionsInTurn;
        nextStateCandidate.randomEvents = nextStateCandidate.randomEvents.concat(newRandomEvents);

        // store the old previous state in the history
        this.history.push(this.currentState);
        this.currentState = nextStateCandidate;
    }

    private clone<T>(obj: T): T {
        return JSON.parse(JSON.stringify(obj));
    }
}