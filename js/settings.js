window.settingsModule = (function() {
    let settings = { pointsPerEconomy: 10, penaltyPerOccurrence: 100, resetMonthly: false, globalGoal: 1.8 };
    let dbId = null; 

    async function load() {
        const { data, error } = await window.supabaseClient.from('configuracoes').select('*').limit(1);
        
        // Backup no navegador caso o banco de dados falhe
        let backupGoal = localStorage.getItem('sys_meta_geral');
        
        if (!error && data && data.length > 0) {
            dbId = data[0].id;
            let dbGoal = data[0].global_goal;
            let finalGoal = 1.8; 
            
            if (dbGoal !== undefined && dbGoal !== null) {
                finalGoal = parseFloat(String(dbGoal).replace(',', '.'));
            } else if (backupGoal) {
                finalGoal = parseFloat(backupGoal);
            }

            settings = {
                pointsPerEconomy: parseFloat(data[0].points_per_economy || 10),
                penaltyPerOccurrence: parseFloat(data[0].penalty_per_occurrence || 100),
                resetMonthly: data[0].reset_monthly || false,
                globalGoal: finalGoal
            };
        } else if (backupGoal) {
            settings.globalGoal = parseFloat(backupGoal);
        }
        
        const pointsInput = document.getElementById('points-per-economy');
        const penaltyInput = document.getElementById('penalty-per-occurrence');
        const resetSelect = document.getElementById('reset-score');
        const goalInput = document.getElementById('global-goal');
        if (pointsInput) pointsInput.value = settings.pointsPerEconomy;
        if (penaltyInput) penaltyInput.value = settings.penaltyPerOccurrence;
        if (resetSelect) resetSelect.value = settings.resetMonthly;
        if (goalInput) goalInput.value = settings.globalGoal;
    }

    async function save() {
        const pointsInput = document.getElementById('points-per-economy').value;
        const penaltyInput = document.getElementById('penalty-per-occurrence').value;
        const resetSelect = document.getElementById('reset-score').value === 'true';
        
        // Força a conversão de vírgula para ponto
        const rawGoalInput = document.getElementById('global-goal').value;
        const safeGoalInput = String(rawGoalInput).replace(',', '.');
        const parsedGoal = parseFloat(safeGoalInput);

        settings = {
            pointsPerEconomy: parseFloat(pointsInput),
            penaltyPerOccurrence: parseFloat(penaltyInput),
            resetMonthly: resetSelect,
            globalGoal: isNaN(parsedGoal) ? 1.8 : parsedGoal
        };

        // Salva backup de segurança no navegador
        localStorage.setItem('sys_meta_geral', settings.globalGoal);

        const dbPayload = {
            points_per_economy: settings.pointsPerEconomy,
            penalty_per_occurrence: settings.penaltyPerOccurrence,
            reset_monthly: settings.resetMonthly,
            global_goal: settings.globalGoal
        };

        if (dbId) {
            await window.supabaseClient.from('configuracoes').update(dbPayload).eq('id', dbId);
        } else {
            const { data } = await window.supabaseClient.from('configuracoes').insert([dbPayload]).select();
            if (data && data.length > 0) dbId = data[0].id;
        }

        if (window.driversModule) window.driversModule.updateScores();
        utils.showAlert('Configurações salvas com sucesso!', 'success');
    }

    function get() { return settings; }

    async function clearAllData() {
        if (confirm("ATENÇÃO: Você está prestes a apagar TODAS as viagens importadas.\nDeseja continuar?")) {
            await window.supabaseClient.from('viagens').delete().neq('id', 0);
            utils.showAlert('Todas as viagens foram apagadas com sucesso.', 'success');
            setTimeout(() => { window.location.reload(); }, 1500);
        }
    }

    return { load, save, get, clearAllData };
})();