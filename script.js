// ============================================================
// 1. SETTINGS (example numbers: the owner edits these)
// ============================================================
const TOTAL_CHAIRS = 100;
const RATE_PER_CHAIR_PER_DAY = 10;   // pesos (example rate)
const DELIVERY_FEE = 150;            // pesos (example fee)
const MAX_DAYS = 30;                 // longest rental allowed
const STORAGE_KEY = 'chairBookings';
const ACTIVE_STATUSES = ['pending', 'confirmed']; // these hold chairs

// ============================================================
// 2. FIND THE ELEMENTS
// ============================================================
const form = document.getElementById('booking-form');
const nameInput = document.getElementById('name');
const phoneInput = document.getElementById('phone');
const startInput = document.getElementById('start-date');
const endInput = document.getElementById('end-date');
const chairsInput = document.getElementById('chairs');
const addressInput = document.getElementById('address');
const addressField = document.getElementById('address-field');
const modeInputs = document.querySelectorAll('input[name="mode"]');
const availabilityBox = document.getElementById('availability');
const estimateBox = document.getElementById('estimate');
const bookingList = document.getElementById('booking-list');
const toast = document.getElementById('toast');
const allInputs = [nameInput, phoneInput, startInput, endInput, chairsInput, addressInput];

// ============================================================
// 4. HELPERS (dates, money, safe text)
// ============================================================
const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

function toISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseDate(iso) {
    return new Date(iso + 'T00:00:00');
}

function todayISO() {
    return toISO(new Date());
}

function formatDate(iso) {
    return parseDate(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Counts both the event day and the return day.
function countDays(start, end) {
    return Math.round((parseDate(end) - parseDate(start)) / 86400000) + 1;
}

// Stops user-typed text from being run as HTML.
function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getMode() {
    return document.querySelector('input[name="mode"]:checked').value;
}

function calcTotal(qty, days, mode) {
    return qty * RATE_PER_CHAIR_PER_DAY * days + (mode === 'delivery' ? DELIVERY_FEE : 0);
}

let toastTimer;
function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

// ============================================================
// 5. DATA: the list of bookings is the single source of truth
// ============================================================
function loadBookings() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
        return [];
    }
}

let bookings = loadBookings();

function saveBookings() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings)); } catch (e) { /* ignore */ }
}

// ============================================================
// 6. AVAILABILITY: the core rule
//    chairs free = total chairs - chairs booked on the busiest day
// ============================================================
function getAvailableChairs(start, end) {
    let busiest = 0;
    const day = parseDate(start);
    const last = parseDate(end);

    while (day <= last) {
        const iso = toISO(day);
        const bookedToday = bookings
            .filter((b) => ACTIVE_STATUSES.includes(b.status) && b.start <= iso && iso <= b.end)
            .reduce((sum, b) => sum + b.qty, 0);
        busiest = Math.max(busiest, bookedToday);
        day.setDate(day.getDate() + 1);
    }

    return TOTAL_CHAIRS - busiest;
}

// Returns a message if the dates are not usable, or '' if they are fine.
function checkDates(start, end) {
    if (!start || !end) return 'Pick your event date and return date.';
    if (start < todayISO()) return 'The event date cannot be in the past.';
    if (end < start) return 'The return date cannot be before the event date.';
    if (countDays(start, end) > MAX_DAYS) return `Rentals are limited to ${MAX_DAYS} days.`;
    return '';
}

// ============================================================
// 7. LIVE SUMMARY: availability and price update as the user types
// ============================================================
function updateSummary() {
    const start = startInput.value;
    const end = endInput.value;
    const qty = Number(chairsInput.value);

    const dateProblem = checkDates(start, end);
    if (dateProblem) {
        availabilityBox.textContent = dateProblem;
        estimateBox.textContent = '';
        return;
    }

    const available = getAvailableChairs(start, end);
    availabilityBox.textContent = `${available} of ${TOTAL_CHAIRS} chairs available for these dates`;

    if (!qty || qty < 1) {
        estimateBox.textContent = '';
    } else if (qty > available) {
        estimateBox.textContent = `Only ${available} chairs are left. Please lower the number of chairs.`;
    } else {
        const days = countDays(start, end);
        const mode = getMode();
        estimateBox.textContent =
            `Estimated total: ${money.format(calcTotal(qty, days, mode))} ` +
            `(${qty} chairs x ${money.format(RATE_PER_CHAIR_PER_DAY)} x ${days} day(s)` +
            `${mode === 'delivery' ? ' + delivery' : ''})`;
    }
}

// ============================================================
// 8. FORM VALIDATION
// ============================================================
function showError(input, message) {
    document.getElementById(input.id + '-error').textContent = message;
    input.classList.add('invalid');
}

function clearError(input) {
    document.getElementById(input.id + '-error').textContent = '';
    input.classList.remove('invalid');
}

function validateForm() {
    let isValid = true;
    allInputs.forEach(clearError);

    if (nameInput.value.trim().length < 2) {
        showError(nameInput, 'Enter your full name.');
        isValid = false;
    }

    const phone = phoneInput.value.replace(/[\s-]/g, '');
    if (!/^(09|\+639)\d{9}$/.test(phone)) {
        showError(phoneInput, 'Enter a valid mobile number, like 09123456789.');
        isValid = false;
    }

    const start = startInput.value;
    const end = endInput.value;
    let datesOk = true;

    if (!start) {
        showError(startInput, 'Pick an event date.');
        datesOk = false;
    } else if (start < todayISO()) {
        showError(startInput, 'The event date cannot be in the past.');
        datesOk = false;
    }

    if (!end) {
        showError(endInput, 'Pick a return date.');
        datesOk = false;
    } else if (start && end < start) {
        showError(endInput, 'The return date cannot be before the event date.');
        datesOk = false;
    } else if (datesOk && countDays(start, end) > MAX_DAYS) {
        showError(endInput, `Rentals are limited to ${MAX_DAYS} days.`);
        datesOk = false;
    }

    const qty = Number(chairsInput.value);
    if (!Number.isInteger(qty) || qty < 1) {
        showError(chairsInput, 'Enter at least 1 chair.');
        isValid = false;
    } else if (datesOk) {
        const available = getAvailableChairs(start, end);
        if (qty > available) {
            showError(chairsInput, `Only ${available} chairs are available for these dates.`);
            isValid = false;
        }
    }

    if (getMode() === 'delivery' && addressInput.value.trim().length < 5) {
        showError(addressInput, 'Enter the delivery address.');
        isValid = false;
    }

    return isValid && datesOk;
}

// ============================================================
// 9. SAVE A NEW BOOKING
// ============================================================
form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!validateForm()) return;

    const start = startInput.value;
    const end = endInput.value;
    const qty = Number(chairsInput.value);
    const mode = getMode();

    bookings.push({
        id: Date.now(),
        name: nameInput.value.trim(),
        phone: phoneInput.value.trim(),
        start,
        end,
        qty,
        mode,
        address: mode === 'delivery' ? addressInput.value.trim() : '',
        total: calcTotal(qty, countDays(start, end), mode),
        status: 'pending'
    });

    saveBookings();
    renderBookings();
    form.reset();
    addressField.hidden = true;
    updateSummary();
    showToast('Booking requested. Status: pending confirmation.');
});

// ============================================================
// 10. OWNER VIEW: show bookings and change their status
// ============================================================
const STATUS_ACTIONS = {
    pending: [['confirmed', 'Confirm'], ['cancelled', 'Cancel']],
    confirmed: [['returned', 'Mark returned'], ['cancelled', 'Cancel']],
    cancelled: [],
    returned: []
};

function renderBookings() {
    if (bookings.length === 0) {
        bookingList.innerHTML = '<p class="empty">No bookings yet. New requests will appear here.</p>';
        return;
    }

    const sorted = [...bookings].sort((a, b) => a.start.localeCompare(b.start));

    bookingList.innerHTML = sorted.map((b) => `
        <article class="booking-card">
            <div class="booking-main">
                <h3>${escapeHtml(b.name)}</h3>
                <p>${escapeHtml(b.phone)}</p>
                <p>${formatDate(b.start)} to ${formatDate(b.end)} (${countDays(b.start, b.end)} day(s))</p>
                <p>${b.qty} chairs, ${b.mode === 'delivery' ? 'delivery to ' + escapeHtml(b.address) : 'pickup'}</p>
                <p class="booking-total">${money.format(b.total)}</p>
            </div>
            <div class="booking-side">
                <span class="status status-${b.status}">${b.status}</span>
                <div class="booking-actions">
                    ${STATUS_ACTIONS[b.status].map(([next, label]) =>
        `<button class="action-btn" data-id="${b.id}" data-status="${next}">${label}</button>`
    ).join('')}
                </div>
            </div>
        </article>
    `).join('');
}

// One listener on the list handles every button inside it.
bookingList.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-id]');
    if (!button) return;

    const booking = bookings.find((b) => b.id === Number(button.dataset.id));
    if (!booking) return;

    booking.status = button.dataset.status;
    saveBookings();
    renderBookings();
    updateSummary();
    showToast(`Booking ${booking.status}.`);
});

// ============================================================
// 11. WIRE UP THE FORM AND START
// ============================================================
[startInput, endInput, chairsInput].forEach((input) => {
    input.addEventListener('input', updateSummary);
});

startInput.addEventListener('input', () => {
    endInput.min = startInput.value || todayISO();
});

modeInputs.forEach((radio) => {
    radio.addEventListener('change', () => {
        addressField.hidden = getMode() !== 'delivery';
        updateSummary();
    });
});

allInputs.forEach((input) => {
    input.addEventListener('input', () => clearError(input));
});

startInput.min = todayISO();
endInput.min = todayISO();
updateSummary();
renderBookings();

// ============================================================
// 12. SHOW THE SETTINGS ON THE PAGE (one place to change the numbers)
// ============================================================
document.getElementById('stock-total').textContent = TOTAL_CHAIRS;
document.getElementById('price-rate').textContent = money.format(RATE_PER_CHAIR_PER_DAY);
document.getElementById('price-delivery').textContent = money.format(DELIVERY_FEE);
