/**
 * portal.js — Fully sequential cascading filters.
 *
 * Full chain (each depends on all previous):
 * Year → Make → Model → Trim → Body → Drivetrain → Engine →
 * Transmission → Region → Doors → Seats → Cylinders → Category
 *
 * If a field has only ONE option, it auto-selects and cascades to the next.
 */

const API_BASE = 'http://127.0.0.1:8001/api/vehicles';

const VIN_API_BASE = 'http://127.0.0.1:8002/api/vin';

// ─── Cascade chain definition ──────────────────────────────────────
// Each entry: [selectId, API field name, placeholder text]
const CASCADE_CHAIN = [
    ['select-year', 'year', '— Select Year —'],
    ['select-make', 'make', '— Select Make —'],
    ['select-model', 'model', '— Select Model —'],
    ['select-trim', 'trim', '— Select Trim —'],
    ['select-body', 'body', '— Select Body —'],
    ['select-drivetrain', 'drivetrain', '— Select Drive Train —'],
    ['select-engine', 'engine', '— Select Engine —'],
    ['select-transmission', 'transmission', '— Select Transmission —'],
    ['select-region', 'region', '— Select Region —'],
    ['select-doors', 'doors', '— Select Doors —'],
    ['select-seats', 'seats', '— Select Seats —'],
    ['select-cylinders', 'cylinder', '— Select Cylinders —'],
    ['select-category', 'category', '— Select Vehicle Class —'],
];

// ─── Helpers ───────────────────────────────────────────────────────

async function apiFetch(endpoint) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`[API Error] ${endpoint}:`, error.message);
        return [];
    }
}

/**
 * Build a query string from all selected values UP TO (but not including)
 * the field at `upToIndex`.
 */
function buildQuery(upToIndex) {
    const params = new URLSearchParams();
    for (let i = 0; i < upToIndex; i++) {
        const [selectId, fieldName] = CASCADE_CHAIN[i];
        const el = document.getElementById(selectId);
        if (el && el.value) {
            params.set(fieldName, el.value);
        }
    }
    return params.toString();
}

/**
 * Reset all selects from `fromIndex` to the end of the chain.
 */
function resetFrom(fromIndex) {
    for (let i = fromIndex; i < CASCADE_CHAIN.length; i++) {
        const [selectId, , placeholder] = CASCADE_CHAIN[i];
        const el = document.getElementById(selectId);
        if (el) {
            el.innerHTML = `<option value="">${placeholder}</option>`;
            el.disabled = true;
        }
    }
}

/**
 * Normalize strings for robust matching (e.g. "MERCEDES-BENZ" -> "mercedes benz", "vw" -> "volkswagen")
 */
function normalizeString(str) {
    if (!str) return '';
    let s = String(str).toLowerCase().trim();
    
    // Remove punctuation
    s = s.replace(/[-_.,!?'"]/g, ' ');
    // Remove extra spaces
    s = s.replace(/\s+/g, ' ');

    // Common make aliases
    const aliases = {
        'mercedes benz': 'mercedes',
        'mercedes-benz': 'mercedes',
        'vw': 'volkswagen',
        'chevy': 'chevrolet',
        'land rover': 'land-rover',
    };

    // Return mapped alias or original normalized string
    // We try to map the string, if it's an alias we return the base, 
    // otherwise we return the string itself allowing partial matches later
    return aliases[s] || s;
}

/**
 * Map VIN response fields to the cascade chain field names.
 */
function getAutoFillTarget(fieldName, vData) {
    if (!vData) return null;
    let val = null;
    switch(fieldName) {
        case 'year': 
            val = vData.modelyear || vData.year_from_vin || vData['Model Year']; 
            break;
        case 'make': 
            val = vData.make || vData.manufacturer || vData['Make']; 
            break;
        case 'model': 
            val = vData.model_name || vData['Model']; 
            break;
        case 'trim': 
            val = vData.trim || vData['Trim']; 
            break;
        case 'category': 
            val = vData.type || vData.category || vData['Vehicle Type']; 
            break;
        default: 
            val = vData[fieldName]; 
            break;
    }
    return val ? normalizeString(val) : null;
}

/**
 * Load options for the field at `index` in the cascade chain.
 * If `autoFillData` is provided, try to match and auto-select.
 * If only ONE option exists → auto-select it and load the next field.
 */
async function loadField(index, autoFillData = null) {
    if (index >= CASCADE_CHAIN.length) {
        // All fields filled → do final vehicle search
        onAllFieldsSelected();
        return;
    }

    const [selectId, fieldName, placeholder] = CASCADE_CHAIN[index];
    const el = document.getElementById(selectId);
    const query = buildQuery(index);

    const data = await apiFetch(`/options/${fieldName}/?${query}`);

    // Populate the select
    el.innerHTML = `<option value="">${placeholder}</option>`;
    data.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.value;
        opt.textContent = item.value;
        el.appendChild(opt);
    });
    el.disabled = false;

    let autoFilled = false;
    
    // 1. Try to auto-fill from VIN data
    if (autoFillData) {
        const targetVal = getAutoFillTarget(fieldName, autoFillData);
        if (targetVal) {
            // Find option using normalized string comparison
            // Also allow partial matches (e.g. if DB has "MERCEDES BENZ" and target is "mercedes")
            const matchedOpt = Array.from(el.options).find(opt => {
                if (!opt.value) return false; // Ignore placeholder options
                const optVal = normalizeString(opt.value);
                return optVal === targetVal || 
                       (fieldName === 'make' && (optVal.includes(targetVal) || targetVal.includes(optVal)));
            });

            if (matchedOpt) {
                el.value = matchedOpt.value;
                console.log(`✨ Auto-filled ${fieldName}: ${matchedOpt.value} from VIN (matched: ${targetVal})`);
                autoFilled = true;
                // Cascade to next field, passing along the auto fill data
                await loadField(index + 1, autoFillData);
            } else {
                console.log(`⚠️ Could NOT auto-fill ${fieldName}: value '${targetVal}' not found in DB options. Stopping auto-fill.`);
                autoFillData = null; // stop auto-filling further down
            }
        } else {
            // We don't have this field in VIN data, stop auto-fill
            autoFillData = null;
        }
    }

    // 2. Auto-select if only ONE option (and we haven't already auto-filled it from VIN)
    if (!autoFilled && data.length === 1) {
        el.value = data[0].value;
        console.log(`⚡ Auto-selected ${fieldName}: ${data[0].value}`);
        // Cascade to next field automatically
        await loadField(index + 1, autoFillData);
    }
}

/**
 * When ALL fields in the cascade have been filled, search for the vehicle.
 */
async function onAllFieldsSelected() {
    const query = buildQuery(CASCADE_CHAIN.length);
    const results = await apiFetch(`/search/?${query}`);

    if (results.length > 0) {
        console.log(`✅ Found ${results.length} vehicle(s):`, results[0]);
        const btnValuate = document.getElementById('btn-valuate');
        if (btnValuate) {
            btnValuate.dataset.vehicleId = results[0].id;
            btnValuate.classList.remove('btn-disabled');
            btnValuate.classList.add('btn-primary');
        }
    } else {
        console.warn('⚠️ No vehicles found for these filters.');
    }
}

// ─── Event listeners: when a field changes → reset downstream + load next ──

CASCADE_CHAIN.forEach(([selectId], index) => {
    const el = document.getElementById(selectId);
    if (!el) return;

    el.addEventListener('change', async () => {
        // Reset everything after this field
        resetFrom(index + 1);

        if (!el.value) return;

        // Load the next field in the chain
        await loadField(index + 1);
    });
});

// ─── VIN Decode: "Get Vehicle Details" button ──────────────────────

const btnGetDetails = document.getElementById('btn-get-details');
const vinInput = document.getElementById('vin-input');

if (btnGetDetails && vinInput) {
    btnGetDetails.addEventListener('click', async () => {
        const vin = vinInput.value.trim().toUpperCase();

        if (!vin) {
            alert('Введите VIN-номер');
            return;
        }

        if (vin.length !== 17) {
            alert(`VIN должен содержать 17 символов (сейчас: ${vin.length})`);
            return;
        }

        btnGetDetails.disabled = true;
        btnGetDetails.textContent = 'Searching...';

        try {
            const response = await fetch(`${VIN_API_BASE}/decode/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vin }),
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();

            console.log('🔍 VIN Decode result:', result);

            if (!result.is_valid) {
                alert(`Неверный формат VIN: ${result.errors?.join(', ') || 'unknown error'}`);
                return;
            }

            if (result.source === 'not_found') {
                alert(`VIN ${vin} не найден ни в локальной БД, ни в NHTSA API.`);
                console.log(`ℹ️ Manufacturer: ${result.manufacturer || 'unknown'}, Year from VIN: ${result.year_from_vin || 'unknown'}`);
                return;
            }

            const v = result.vehicle;

            if (result.source === 'local_db') {
                console.log(`✅ VIN найден в локальной БД точно по номеру! Запуск автозаполнения...`);
            } else if (result.source === 'local_db_vds_ext') {
                console.log(`✅ VIN найден по алгоритму VDS Extended (приближенный). Запуск автозаполнения...`);
            } else if (result.source === 'local_db_vds') {
                console.log(`✅ VIN найден по алгоритму VDS (по первым 8 символам). Запуск автозаполнения...`);
            } else if (result.source === 'nhtsa_api') {
                console.log(`✅ VIN декодирован через NHTSA API! Запуск автозаполнения...`);
            } else if (result.source === 'fallback_wmi') {
                console.log(`⚠️ VIN не найден. Используем базовую расшифровку (Год и Производитель)...`);
                alert(`К сожалению, детальных данных по этому VIN нет.\nВ поля будут подставлены базовые данные: Год (${result.year_from_vin || 'Н/Д'}) и Марка (${result.manufacturer || 'Н/Д'}).`);
            } else if (result.source === 'not_found') {
                alert(`VIN ${vin} не найден ни в одной из баз.`);
                return;
            }

            // Start auto-filling the cascade from the top
            resetFrom(0);
            await loadField(0, v);

        } catch (error) {
            console.error('[VIN Decode Error]:', error.message);
            alert(`Ошибка при запросе VIN: ${error.message}`);
        } finally {
            btnGetDetails.disabled = false;
            btnGetDetails.textContent = 'Get Vehicle Details';
        }
    });
}

// ─── Valuation: "Valuate" button ────────────────────────────────────

const VALUATION_API_BASE = 'http://127.0.0.1:8003/api/valuation';

const btnValuate = document.getElementById('btn-valuate');
if (btnValuate) {
    btnValuate.addEventListener('click', async () => {
        const vehicleId = btnValuate.dataset.vehicleId;
        if (!vehicleId) {
            alert('Сначала выберите автомобиль через каскадные фильтры или VIN.');
            return;
        }

        const mileageInput = document.getElementById('mileage-input');
        const actualMileage = parseInt(mileageInput?.value || '0', 10);

        const isNewCheckbox = document.querySelector('.checkbox-group input[type="checkbox"]');
        const isNew = isNewCheckbox?.checked || false;

        btnValuate.disabled = true;
        btnValuate.textContent = 'Calculating...';

        try {
            const response = await fetch(`${VALUATION_API_BASE}/calculate/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vehicle_id: parseInt(vehicleId, 10),
                    actual_mileage: actualMileage,
                    is_new: isNew,
                }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${response.status}`);
            }

            const result = await response.json();
            console.log('💰 Valuation result:', result);

            // Format currency
            const fmt = (n) => new Intl.NumberFormat('en-US', {
                style: 'currency', currency: 'USD', maximumFractionDigits: 0,
            }).format(n);

            document.getElementById('val-high').textContent = fmt(result.high);
            document.getElementById('val-medium').textContent = fmt(result.medium);
            document.getElementById('val-low').textContent = fmt(result.low);

            // Update est-mileage with the average mileage from backend
            const estMileageInput = document.getElementById('est-mileage-input');
            if (estMileageInput) {
                estMileageInput.value = result.avg_mileage;
            }

        } catch (error) {
            console.error('[Valuation Error]:', error.message);
            alert(`Ошибка расчёта: ${error.message}`);
        } finally {
            btnValuate.disabled = false;
            btnValuate.textContent = 'Valuate';
            btnValuate.classList.remove('btn-disabled');
            btnValuate.classList.add('btn-primary');
        }
    });
}

// ─── Initialize: load the first field (years) ─────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚗 Portal initializing — loading years...');
    await loadField(0);
    console.log('🚗 Portal ready — cascade filters + VIN decode + valuation active');
});

