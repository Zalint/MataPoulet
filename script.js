// Global store for results to export
let exportData = {};

document.addEventListener('DOMContentLoaded', () => {
    const calculateBtn = document.getElementById('calculateBtn');
    const exportBtn = document.getElementById('exportBtn');
    const resultsDiv = document.getElementById('results');

    // Input elements references
    const inputs = {
        // Mixte
        anr: document.getElementById('anr'),
        ca_total_mix: document.getElementById('ca_total_mix'),
        assurance_broilers_mix: document.getElementById('assurance_broilers_mix'),
        ev_ebitda_multiple: document.getElementById('ev_ebitda_multiple'),
        weight_anr: document.getElementById('weight_anr'),
        weight_ebitda: document.getElementById('weight_ebitda'),
        // DCF
        ca_initial_dcf: document.getElementById('ca_initial_dcf'),
        marge_exploitation: document.getElementById('marge_exploitation'),
        assurance_broilers_dcf: document.getElementById('assurance_broilers_dcf'),
        amortissements: document.getElementById('amortissements'),
        taux_is: document.getElementById('taux_is'),
        capex: document.getElementById('capex'),
        bfr_y1: document.getElementById('bfr_y1'),
        wacc: document.getElementById('wacc'),
        growth_terminal: document.getElementById('growth_terminal'),
    };

    // Result display elements
    const resultsDisplay = {
        ebitda_net: document.getElementById('result_ebitda_net'),
        mix_value: document.getElementById('result_mix_value'),
        dcf_value: document.getElementById('result_dcf_value'),
    };

    // Helper function to get number value from input or default
    const getNumValue = (element, defaultValue = 0) => {
        const value = parseFloat(element.value);
        return isNaN(value) ? defaultValue : value;
    };

    // Helper function to format currency
    const formatCurrency = (value) => {
        if (isNaN(value) || value === null) return 'N/A';
        return `${value.toFixed(2)}`;
    };

    const calculateMixedValue = (params) => {
        const anr = params.anr;
        const ca_total = params.ca_total_mix;
        const assurance = params.assurance_broilers_mix;
        const multiple = params.ev_ebitda_multiple;
        let weightAnr = params.weight_anr / 100;
        let weightEbitda = params.weight_ebitda / 100;

        // Ensure weights sum to 1 (or handle if they don't)
        if (weightAnr + weightEbitda !== 1) {
            // Optional: Add normalization or warning
            console.warn("Les pondérations ANR et EBITDA ne totalisent pas 100%. Ajustement proportionnel.");
            const totalWeight = weightAnr + weightEbitda;
             if (totalWeight > 0) {
                 weightAnr = weightAnr / totalWeight;
                 weightEbitda = weightEbitda / totalWeight;
             }
        }

        // Calculate EBITDA (based on Mix inputs)
        // Using 18% as specified in the prompt description, not the DCF marge_exploitation input
        const ebitda = (ca_total * 0.18) - assurance;
        const ebitdaValue = ebitda * multiple;

        const mixedValue = (anr * weightAnr) + (ebitdaValue * weightEbitda);

        return { value: mixedValue, ebitda: ebitda };
    };

    const calculateDCFValue = (params) => {
        const ca_initial = params.ca_initial_dcf;
        const margeExploitation = params.marge_exploitation / 100; // Convert percentage
        const assurance = params.assurance_broilers_dcf;
        const amortissements = params.amortissements;
        const tauxIS = params.taux_is / 100; // Convert percentage
        const capex = params.capex;
        const bfr_y1 = params.bfr_y1;
        const wacc = params.wacc / 100; // Convert percentage
        const g = params.growth_terminal / 100; // Convert percentage

        if (wacc <= g) {
            alert("Erreur: Le WACC doit être supérieur au taux de croissance terminal (g) pour le calcul DCF.");
            return { value: NaN }; // Indicate error
        }

        let cumulativePV_FCFF = 0;
        let last_fcff = 0;

        // Calculate FCFF for 5 years
        // Assuming 0% CA growth for the first 5 years as not specified otherwise
        for (let t = 1; t <= 5; t++) {
            const current_ca = ca_initial; // No growth specified for projection years
            const ebitda_t = (current_ca * margeExploitation) - assurance;
            const ebit_t = ebitda_t - amortissements;
            const nopat_t = ebit_t * (1 - tauxIS);

            // BFR variation is only for year 1, 0 otherwise
            const delta_bfr_t = (t === 1) ? bfr_y1 : 0;

            const fcff_t = nopat_t + amortissements - capex - delta_bfr_t;

            // Discount FCFF to present value
            const pv_fcff_t = fcff_t / Math.pow(1 + wacc, t);
            cumulativePV_FCFF += pv_fcff_t;

            if (t === 5) {
                last_fcff = fcff_t;
            }
        }

        // Calculate Terminal Value (TV)
        const terminalValue = (last_fcff * (1 + g)) / (wacc - g);

        // Discount TV to present value
        const pv_terminalValue = terminalValue / Math.pow(1 + wacc, 5);

        const dcfValue = cumulativePV_FCFF + pv_terminalValue;

        return { value: dcfValue };
    };

    const performCalculations = () => {
        // Read all values
        const params = {};
        for (const key in inputs) {
            params[key] = getNumValue(inputs[key], inputs[key].value ? undefined : parseFloat(inputs[key].defaultValue || 0));
        }

        // Calculate values
        const mixResult = calculateMixedValue(params);
        const dcfResult = calculateDCFValue(params);

        // Store results for export
        exportData = {
            inputs: params,
            results: {
                ebitda_net: mixResult.ebitda,
                mix_value: mixResult.value,
                dcf_value: dcfResult.value
            }
        };

        // Display results
        resultsDisplay.ebitda_net.textContent = `EBITDA Net (calculé pour Mix): ${formatCurrency(mixResult.ebitda)} M FCFA`;
        resultsDisplay.mix_value.textContent = `Valeur Mixte: ${formatCurrency(mixResult.value)} M FCFA`;
        resultsDisplay.dcf_value.textContent = `Valeur DCF: ${formatCurrency(dcfResult.value)} M FCFA`;

        resultsDiv.style.display = 'block'; // Show results section

        // ***************** CALCUL ET AFFICHAGE GOODWILL *****************
        const goodwillRate = h.goodwillRate; // Taux lu depuis les hypothèses
        const mixValueWithGW = mixResult.value * (1 + goodwillRate);
        const dcfValueWithGW = dcfResult.value * (1 + goodwillRate);

        // Afficher dans l'onglet Goodwill
        const mixValueBaseGWEl = document.getElementById('mixValueBaseGW');
        const mixValueGWEl = document.getElementById('mixValueGW');
        const dcfValueBaseGWEl = document.getElementById('dcfValueBaseGW');
        const dcfValueGWEl = document.getElementById('dcfValueGW');
        const mixFinalValueGWEl = document.getElementById('mixFinalValueGW');
        const dcfFinalValueGWEl = document.getElementById('dcfFinalValueGW');

        if(mixValueBaseGWEl) mixValueBaseGWEl.textContent = formatNumber(mixResult.value, 1);
        if(mixValueGWEl) mixValueGWEl.textContent = formatNumber(mixValueWithGW, 1);
        if(dcfValueBaseGWEl) dcfValueBaseGWEl.textContent = formatNumber(dcfResult.value, 1);
        if(dcfValueGWEl) dcfValueGWEl.textContent = formatNumber(dcfValueWithGW, 1);
        if(mixFinalValueGWEl) mixFinalValueGWEl.textContent = `${formatNumber(mixValueWithGW, 1)} M FCFA`;
        if(dcfFinalValueGWEl) dcfFinalValueGWEl.textContent = `${formatNumber(dcfValueWithGW, 1)} M FCFA`;
        
        // Mettre à jour l'exemple de Goodwill dans l'explication
        const goodwillExampleBaseEl = document.getElementById('goodwillExampleBase');
        const goodwillExampleRateEl = document.getElementById('goodwillExampleRate');
        const goodwillExampleResultEl = document.getElementById('goodwillExampleResult');
        
        if(goodwillExampleBaseEl && goodwillExampleRateEl && goodwillExampleResultEl) {
            // Utiliser mixValue arrondi à l'entier pour l'exemple
            const exampleBase = Math.round(mixResult.value);
            const exampleRate = Math.round(goodwillRate * 100);
            const exampleResult = Math.round(exampleBase * (1 + goodwillRate));
            
            goodwillExampleBaseEl.textContent = formatNumber(exampleBase, 0);
            goodwillExampleRateEl.textContent = exampleRate;
            goodwillExampleResultEl.textContent = formatNumber(exampleResult, 0);
        }
        // ***************** FIN CALCUL ET AFFICHAGE GOODWILL *****************
    };

    const exportToCSV = () => {
        if (!exportData.results) {
            alert("Veuillez d'abord calculer les résultats avant d'exporter.");
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Paramètre,Valeur\n"; // Header row

        // Add inputs to CSV
        csvContent += "--- Paramètres Entrés ---\n";
        for (const key in exportData.inputs) {
            const labelElement = document.querySelector(`label[for='${inputs[key].id}']`);
            const labelText = labelElement ? labelElement.textContent.replace(':', '').trim() : key;
            csvContent += `"${labelText}",${exportData.inputs[key]}\n`;
        }

        // Add results to CSV
        csvContent += "--- Résultats Calculés (M FCFA) ---\n";
        csvContent += `"EBITDA Net (Mix)",${formatCurrency(exportData.results.ebitda_net)}\n`;
        csvContent += `"Valeur Mixte",${formatCurrency(exportData.results.mix_value)}\n`;
        csvContent += `"Valeur DCF",${formatCurrency(exportData.results.dcf_value)}\n`;

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "valorisation_avicole.csv");
        document.body.appendChild(link); // Required for Firefox

        link.click(); // This will download the data file
        document.body.removeChild(link); // Clean up
    };

    // Add event listeners
    calculateBtn.addEventListener('click', performCalculations);
    exportBtn.addEventListener('click', exportToCSV);

    // Ensure weights add up dynamically (Optional enhancement)
    inputs.weight_anr.addEventListener('input', () => {
        const anrWeight = getNumValue(inputs.weight_anr, 0);
        if (anrWeight >= 0 && anrWeight <= 100) {
           inputs.weight_ebitda.value = 100 - anrWeight;
        }
    });
    inputs.weight_ebitda.addEventListener('input', () => {
         const ebitdaWeight = getNumValue(inputs.weight_ebitda, 0);
         if (ebitdaWeight >= 0 && ebitdaWeight <= 100) {
            inputs.weight_anr.value = 100 - ebitdaWeight;
         }
    });

}); 