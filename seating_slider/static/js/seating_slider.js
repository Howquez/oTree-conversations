// ── Seat map ──────────────────────────────────────────────────────────────────
const ROWS = Array.from({ length: 10 }, (_, i) => 45 + i);
const EXIT_ROW = 45;
const COLS = ['A', 'B', null, 'C', 'D', 'E', 'F', null, 'G', 'H'];

function buildSeatMap() {
    const map = document.getElementById('seat-map');

    const facRow = document.createElement('div');
    facRow.className = 'sm-row sm-facility-row';
    facRow.appendChild(makeRowLabel(''));
    const bar = document.createElement('div');
    bar.className = 'sm-facilities-bar';
    ['WC', 'WC', 'WC'].forEach(() => {
        const wc = document.createElement('span');
        wc.className = 'sm-wc';
        wc.textContent = 'WC';
        bar.appendChild(wc);
    });
    facRow.appendChild(bar);
    facRow.appendChild(makeRowLabel(''));
    map.appendChild(facRow);

    ROWS.forEach(row => {
        const rowEl = document.createElement('div');
        rowEl.className = 'sm-row' + (row === EXIT_ROW ? ' sm-exit-row' : '');

        if (row === EXIT_ROW) rowEl.appendChild(makeExitSign());
        else rowEl.appendChild(makeRowLabel(row));

        COLS.forEach(col => {
            if (col === null) {
                const aisle = document.createElement('div');
                aisle.className = 'sm-aisle';
                rowEl.appendChild(aisle);
            } else {
                const seatId = `${row}${col}`;
                const seat = document.createElement('div');
                seat.className = 'sm-seat';
                seat.id = `seat-${seatId}`;
                if (seatId === SEAT_A) { seat.classList.add('option-a'); seat.textContent = 'A'; }
                else if (seatId === SEAT_B) { seat.classList.add('option-b'); seat.textContent = 'B'; }
                rowEl.appendChild(seat);
            }
        });

        if (row === EXIT_ROW) rowEl.appendChild(makeExitSign());
        else rowEl.appendChild(makeRowLabel(''));

        map.appendChild(rowEl);
    });
}

function makeExitSign() {
    const el = document.createElement('div');
    el.className = 'sm-exit-sign';
    el.title = 'Emergency exit';
    el.textContent = 'EXIT';
    return el;
}

function makeRowLabel(text) {
    const el = document.createElement('div');
    el.className = 'sm-row-label';
    el.textContent = text;
    return el;
}

// ── Slider ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    buildSeatMap();

    const seatEl = document.getElementById(`seat-${SEAT_A}`);
    if (seatEl) seatEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const slider = document.getElementById('id_strength');
    const hint   = document.getElementById('slider-hint');
    const submit = document.getElementById('submit-btn');

    submit.disabled = true;

    slider.addEventListener('input', () => {
        slider.classList.remove('notclicked');
        submit.disabled = false;
        hint.textContent = '';
    });
});
