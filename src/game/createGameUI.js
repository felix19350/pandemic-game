/* eslint-disable no-unused-vars */
import * as $ from 'jquery';
import { months } from '../lib/util';
/* 
Shorthand functions to create DOM elements

    Arguments
    --------
    type = HTML tag of element to create (string)
    parentEle = parent to append element to (HTML element)
    id = id to give element, optional (string)
*/

const createEle = (type, parentEle, id = null) => {
    const ele = document.createElement(type);
    if (id) {
        ele.id = id;
    }
    parentEle.appendChild(ele);

    return ele;
};

/*

Create Game UI
==============
Description:
Intended to produce elements no the DOM for both viewing and controlling the game.

Use:
Elements created by this method accessed by their IDs

*/
export const createGameUI = (
    gameOptions,
    listOfPlayerActions,
    showWelcomeScreenAtStart,
    onPlayerSelectsAction,
    onEndTurn,
    onUndo,
    onRestart,
    numberOfColumns = 12
) => {
    // Show welcome screen if the options allow for it
    if (gameOptions.showWelcomeScreenAtStart) {
        $('#welcome-screen').modal('show');
    }

    const tableRoot = $(`#player-actions-container`)[0];

    // Create table footer
    const header = createEle('tr', tableRoot);
    createEle('th', header);
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < numberOfColumns; i++) {
        const date = createEle('th', header);
        date.innerHTML = `${months[i].name}<br/>2021`; // Numbered months not named
        date.className = 'noselect';
        date.style.textAlign = 'center';
    }

    const btnClickHandler = (e) => {
        // Style as active/inactive
        const target = $(e.target);
        target.toggleClass('btn-light');
        target.toggleClass('btn-success');

        // Change label text on click
        const label = target.html();
        if (label === target.attr('data-activeLabel')) {
            target.html(target.attr('data-inactiveLabel'));
        } else {
            target.html(target.attr('data-activeLabel'));
        }

        // On player selects action pass action to event
        onPlayerSelectsAction(target.attr('data-action'));
    };

    // Create the table body
    const tableBody = createEle('tbody', tableRoot);
    const buttonLengths = [
        '75px',
        '70px',
        '72px',
        '72px',
        '75px',
        '75px',
        '72px',
        '75px',
        '72px',
        '75px',
        '72px',
        '75px'
    ];
    // eslint-disable-next-line no-restricted-syntax
    for (const action of listOfPlayerActions) {
        const tr = createEle('tr', tableBody);
        const title = createEle('td', tr);
        title.innerHTML = action.name;
        title.className = 'noselect';
        title.style.textAlign = 'right';
        title.style.width = '140px';

        for (let i = 0; i < numberOfColumns; i += 1) {
            const td = createEle('td', tr);
            const btn = createEle('button', td, `turn${i}-${action.id}`);
            btn.className = `player-action m-2 btn btn-sm`;
            btn.style.position = 'relative';
            btn.style.zIndex = '200';
            btn.style.height = 'auto';
            btn.style.width = buttonLengths[i];
            btn.setAttribute('data-action', action.id);
            btn.setAttribute('data-inactiveLabel', action.inactiveLabel);
            btn.setAttribute('data-activeLabel', action.activeLabel);
            btn.innerHTML = action.inactiveLabel;
            btn.onclick = btnClickHandler;
        }
    }

    // Create table footer - current turn
    const tableFooter = createEle('tfoot', tableRoot);
    const indicators = ['cases', 'deaths', 'cost'];

    // HOF to create the footer rows
    const createMonthlyIndictorCells = (isPreviousGameCell) => (indicator, indicatorNum) => {
        const footerRow = createEle('tr', tableFooter);
        if (isPreviousGameCell && indicatorNum === 0) {
            footerRow.style.borderTop = '1px solid #999999';
        }
        for (let i = 0; i < numberOfColumns + 1; i += 1) {
            const id = i > 0 ? `${isPreviousGameCell ? 'last-game-' : ''}month-${indicator}-${i}` : undefined;
            const footerCell = createEle('td', footerRow, id);

            if (i === 0) {
                footerCell.innerHTML = `${indicator.charAt(0).toUpperCase()}${indicator.slice(1)} 
                - ${isPreviousGameCell ? 'last game' : 'this game'}`;
                footerCell.className = 'noselect';
                footerCell.style.textAlign = 'right';
            } else {
                footerCell.innerHTML = '-';
                footerCell.style.textAlign = 'center';
            }
        }
    };

    // Create monthly indicator cells for current playthough
    indicators.forEach(createMonthlyIndictorCells(false));

    // Create monthly indicator cells for next playthroug
    indicators.forEach(createMonthlyIndictorCells(true));

    const footerRow = createEle('tr', tableFooter);

    for (let i = 0; i < numberOfColumns + 1; i += 1) {
        const id = i > 0 ? `month-btns-${i}` : undefined;
        const footerCell = createEle('td', footerRow, id);
        footerCell.style.textAlign = 'center';
        const btnGrp = createEle('DIV', footerCell);
        btnGrp.className = 'btn-group';
        btnGrp.role = 'group';

        if (!(i === 0)) {
            const btn = createEle('button', btnGrp, `endTurn-btn-${i}`);
            btn.className = `btn btn-sm btn-light turn-btn-grp`;
            btn.style.width = '80px'; // '100%';
            btn.name = 'Go forwards in time';
            btn.type = 'button';
            btn.innerHTML = `
                Advance<br/>
                <svg width="25px" height="25px" viewBox="0 0 16 16" class="bi bi-caret-right-fill" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12.14 8.753l-5.482 4.796c-.646.566-1.658.106-1.658-.753V3.204a1 1 0 0 1 1.659-.753l5.48 4.796a1 1 0 0 1 0 1.506z"/>
                </svg>
            `;
            btn.onclick = onEndTurn; // END TURN EVENT (in GameEngine.ts)
        } else {
            const btn = createEle('button', btnGrp, `undo-btn`);
            btn.className = `btn btn-sm btn-light undo-btn-grp`;
            btn.style.width = '80px'; // '100%';
            btn.name = 'Go backwards in time';
            btn.type = 'button';
            btn.innerHTML = `
                Undo<br/>
                <svg width="25px" height="25px" viewBox="0 0 16 16" class="bi bi-caret-left-fill" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3.86 8.753l5.482 4.796c.646.566 1.658.106 1.658-.753V3.204a1 1 0 0 0-1.659-.753l-5.48 4.796a1 1 0 0 0 0 1.506z"/>
                </svg>
            `;
            btn.onclick = onUndo; // UNDO EVENT (in GameEngine.ts)
        }
    }

    // Add extra event handlers
    $(`#restart-btn`).on('click', () => {
        const isChecked = $('#hide-welcome').is(':checked');
        showWelcomeScreenAtStart(!isChecked);
        onRestart();
    });
};
