window.settingsModule = (function() {
    let settings = { pointsPerEconomy: 10, penaltyPerOccurrence: 100, resetMonthly: false, globalGoal: 1.8, cicloInicio: 26, cicloFim: 25 };
    let dbId = null; 

    async function load() {
        const { data, error } = await window.supabaseClient.from('configuracoes').select('*').limit(1);
        
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
                globalGoal: finalGoal,
                cicloInicio: parseInt(data[0].ciclo_inicio || 26),
                cicloFim: parseInt(data[0].ciclo_fim || 25)
            };
        } else if (backupGoal) {
            settings.globalGoal = parseFloat(backupGoal);
        }
        
        const pointsInput = document.getElementById('points-per-economy');
        const penaltyInput = document.getElementById('penalty-per-occurrence');
        const resetSelect = document.getElementById('reset-score');
        const goalInput = document.getElementById('global-goal');
        const cicloInicioInput = document.getElementById('ciclo-inicio');
        const cicloFimInput = document.getElementById('ciclo-fim');

        if (pointsInput) pointsInput.value = settings.pointsPerEconomy;
        if (penaltyInput) penaltyInput.value = settings.penaltyPerOccurrence;
        if (resetSelect) resetSelect.value = settings.resetMonthly;
        if (goalInput) goalInput.value = settings.globalGoal;
        if (cicloInicioInput) cicloInicioInput.value = settings.cicloInicio;
        if (cicloFimInput) cicloFimInput.value = settings.cicloFim;
    }

    async function save() {
        const pointsInput = document.getElementById('points-per-economy').value;
        const penaltyInput = document.getElementById('penalty-per-occurrence').value;
        const resetSelect = document.getElementById('reset-score').value === 'true';
        
        const rawGoalInput = document.getElementById('global-goal').value;
        const safeGoalInput = String(rawGoalInput).replace(',', '.');
        const parsedGoal = parseFloat(safeGoalInput);

        const cicloInicioInput = document.getElementById('ciclo-inicio') ? parseInt(document.getElementById('ciclo-inicio').value) : 26;
        const cicloFimInput = document.getElementById('ciclo-fim') ? parseInt(document.getElementById('ciclo-fim').value) : 25;

        settings = {
            pointsPerEconomy: parseFloat(pointsInput),
            penaltyPerOccurrence: parseFloat(penaltyInput),
            resetMonthly: resetSelect,
            globalGoal: isNaN(parsedGoal) ? 1.8 : parsedGoal,
            cicloInicio: isNaN(cicloInicioInput) ? 26 : cicloInicioInput,
            cicloFim: isNaN(cicloFimInput) ? 25 : cicloFimInput
        };

        localStorage.setItem('sys_meta_geral', settings.globalGoal);

        const dbPayload = {
            points_per_economy: settings.pointsPerEconomy,
            penalty_per_occurrence: settings.penaltyPerOccurrence,
            reset_monthly: settings.resetMonthly,
            global_goal: settings.globalGoal,
            ciclo_inicio: settings.cicloInicio,
            ciclo_fim: settings.cicloFim
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