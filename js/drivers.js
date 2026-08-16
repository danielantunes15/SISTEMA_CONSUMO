window.driversModule = (function() {
    let drivers = [];
    let editingId = null;

    async function loadDrivers() {
        const { data, error } = await window.supabaseClient.from('motoristas').select('*');
        if (!error && data) {
            drivers = data;
        }
        renderDrivers();
        return drivers;
    }

    function filterDrivers() {
        renderDrivers();
    }

    function renderDrivers() {
        const tbody = document.getElementById('drivers-list');
        if (!tbody) return;
        
        const parseNumber = (val) => {
            if (!val) return 0;
            return parseFloat(String(val).replace(',', '.')) || 0;
        };
        const settings = window.settingsModule ? window.settingsModule.get() : { pointsPerEconomy: 10, penaltyPerOccurrence: 100, globalGoal: 1.8 };
        const goal = parseNumber(settings.globalGoal || 1.8);
        
        const getColor = (kml) => {
            const numKml = parseNumber(kml);
            if (numKml <= 0) return '#94a3b8';
            const roundedKml = Number(numKml.toFixed(2));
            const roundedGoal = Number(goal.toFixed(2));
            return roundedKml >= roundedGoal ? '#10b981' : '#f87171';
        };

        const searchInput = document.getElementById('search-driver');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        
        let displayDrivers = drivers.filter(d => (d.name || '').toLowerCase().includes(searchTerm));
        displayDrivers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        const allTrips = window.tripsModule ? window.tripsModule.getAll() : [];
        const allOcorrencias = window.ocorrenciasModule ? window.ocorrenciasModule.getAll() : [];

        tbody.innerHTML = displayDrivers.map(driver => {
            const dTrips = allTrips.filter(t => t.motorista === driver.name);
            const dOcorrencias = allOcorrencias.filter(oc => oc.motorista === driver.name);
            let distTotal = 0;
            let fuelTotal = 0;
            let rawScore = 0;
            dTrips.forEach(t => {
                distTotal += parseFloat(t.distancia_km) || 0;
                fuelTotal += parseFloat(t.total_litros) || 0;
                const kml = parseFloat(t.kml);
                if (!isNaN(kml)) rawScore += kml * settings.pointsPerEconomy;
            });

            const countOcorrencias = Math.max(dOcorrencias.length, driver.occurrences || 0);
            const avgEconomy = fuelTotal > 0 ? distTotal / fuelTotal : 0;
            const finalScore = Math.max(0, Math.round(rawScore - (countOcorrencias * settings.penaltyPerOccurrence)));
            
            const fotoHtml = driver.foto ? `<img src="${driver.foto}" style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover; border: 2px solid #3b82f6;">` : `<div style="width: 35px; height: 35px; border-radius: 50%; background: #1e293b; border: 1px solid #475569; display: flex; align-items: center; justify-content: center;"><i class="fas fa-user" style="color: #94a3b8;"></i></div>`;

            return `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 12px; font-weight: 500; color: #f8fafc;">
                        ${fotoHtml}
                        ${escapeHtml(driver.name)}
                    </div>
                </td>
                <td>${utils.formatCPF(driver.cpf)}</td>
                <td style="font-weight: 600; color: #38bdf8;">${utils.formatNumber(distTotal, 0)} km</td>
                <td><span class="status-badge success">${finalScore} pts</span></td>
                <td><span class="status-badge warning">${countOcorrencias}</span></td>
                <td style="color: ${getColor(avgEconomy)}; font-weight: 600;">${avgEconomy > 0 ? utils.formatNumber(avgEconomy) : '0.00'} km/L</td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn-primary btn-sm btn-icon" title="Editar" onclick="window.driversModule.edit(${driver.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn-danger btn-sm btn-icon" style="background: #f59e0b;" title="Adicionar Ocorrência" onclick="window.driversModule.addOccurrence(${driver.id})"><i class="fas fa-exclamation-triangle"></i></button>
                        <button class="btn-danger btn-sm btn-icon" title="Excluir" onclick="window.driversModule.delete(${driver.id})"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');
        
        if (displayDrivers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 20px; color: #94a3b8;"><i class="fas fa-search" style="margin-right: 8px;"></i> Nenhum motorista encontrado</td></tr>';
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div'); div.textContent = text; return div.innerHTML;
    }

    function openModal(driverId = null) {
        editingId = driverId;
        const modal = document.getElementById('driver-modal');
        const title = document.getElementById('modal-title');
        const preview = document.getElementById('foto-preview');
        
        if (driverId) {
            const driver = drivers.find(d => d.id === driverId);
            if (driver) {
                document.getElementById('driver-name').value = driver.name;
                document.getElementById('driver-cpf').value = driver.cpf;
                document.getElementById('driver-matricula').value = driver.matricula;
                document.getElementById('driver-foto-base64').value = driver.foto || '';
                document.getElementById('driver-foto').value = ''; 
                
                preview.innerHTML = driver.foto ? `<img src="${driver.foto}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid #3b82f6;">` : '';
                title.textContent = 'Editar Motorista';
            }
        } else {
            document.getElementById('driver-form').reset();
            document.getElementById('driver-foto-base64').value = '';
            preview.innerHTML = '';
            title.textContent = 'Novo Motorista';
        }
        modal.classList.add('active');
    }

    function closeModal() {
        document.getElementById('driver-modal').classList.remove('active');
        editingId = null;
        document.getElementById('driver-form').reset();
        document.getElementById('foto-preview').innerHTML = '';
    }

    async function saveDriver(event) {
        event.preventDefault();
        const btn = event.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        
        const driverData = {
            name: document.getElementById('driver-name').value,
            cpf: document.getElementById('driver-cpf').value,
            matricula: document.getElementById('driver-matricula').value,
            foto: document.getElementById('driver-foto-base64').value
        };

        if (editingId) {
            await window.supabaseClient.from('motoristas').update(driverData).eq('id', editingId);
            utils.showAlert('Motorista atualizado com sucesso!', 'success');
        } else {
            driverData.occurrences = 0;
            driverData.score = 0;
            driverData.total_distance = 0;
            driverData.total_fuel = 0;
            driverData.avg_economy = 0;
            driverData.last_reset = new Date().toISOString();
            
            await window.supabaseClient.from('motoristas').insert([driverData]);
            utils.showAlert('Motorista cadastrado!', 'success');
        }
        
        await loadDrivers();
        closeModal();
        
        if (window.tripsModule) window.tripsModule.updateDriverStats();
        btn.disabled = false;
    }

    async function deleteDriver(id) {
        if (confirm('Tem certeza que deseja excluir este motorista?')) {
            await window.supabaseClient.from('motoristas').delete().eq('id', id);
            await loadDrivers();
            utils.showAlert('Motorista excluído!', 'success');
            if (window.tripsModule) window.tripsModule.updateDriverStats();
        }
    }

    async function addOccurrence(id) {
        const driver = drivers.find(d => d.id === id);
        if (driver) {
            driver.occurrences++;
            await window.supabaseClient.from('motoristas').update({ occurrences: driver.occurrences }).eq('id', driver.id);
            await updateDriverScore(driver);
            await loadDrivers();
            utils.showAlert(`Ocorrência adicionada para ${driver.name}!`, 'warning');
            if (window.rankingModule) window.rankingModule.render();
            if (window.app) window.app.updateDashboard();
        }
    }

    async function updateDriverScore(driver) {
        const settings = window.settingsModule.get();
        const trips = window.tripsModule ? window.tripsModule.getAll() : [];
        const driverTrips = trips.filter(t => t.motorista === driver.name);
        
        let score = 0; let totalDistance = 0; let totalFuel = 0;
        
        driverTrips.forEach(trip => {
            const kml = parseFloat(trip.kml);
            if (!isNaN(kml)) score += kml * settings.pointsPerEconomy;
            totalDistance += parseFloat(trip.distancia_km) || 0;
            totalFuel += parseFloat(trip.total_litros) || 0;
        });
        
        const newScore = Math.max(0, Math.round(score - (driver.occurrences * settings.penaltyPerOccurrence)));
        const avgEconomy = totalFuel > 0 ? totalDistance / totalFuel : 0;
        
        let payload = {
            score: newScore,
            total_distance: totalDistance,
            total_fuel: totalFuel,
            avg_economy: avgEconomy
        };
        
        if (settings.resetMonthly && utils.shouldResetScore(driver.last_reset)) {
            payload.score = 0;
            payload.occurrences = 0;
            payload.last_reset = new Date().toISOString();
        }
        
        await window.supabaseClient.from('motoristas').update(payload).eq('id', driver.id);
    }

    async function updateAllScores() {
        for (let driver of drivers) {
            await updateDriverScore(driver);
        }
        await loadDrivers();
    }

    function getAllDrivers() { return drivers; }

    document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('driver-form');
        if (form) form.addEventListener('submit', saveDriver);

        const fotoInput = document.getElementById('driver-foto');
        if(fotoInput) {
            fotoInput.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if(file) {
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        document.getElementById('driver-foto-base64').value = event.target.result;
                        document.getElementById('foto-preview').innerHTML = `<img src="${event.target.result}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid #3b82f6;">`;
                    };
                    reader.readAsDataURL(file);
                } else {
                    document.getElementById('driver-foto-base64').value = '';
                    document.getElementById('foto-preview').innerHTML = '';
                }
            });
        }
    });

    return { 
        load: loadDrivers, 
        getAll: getAllDrivers, 
        openModal, 
        closeModal, 
        edit: openModal, 
        delete: deleteDriver, 
        addOccurrence, 
        updateScores: updateAllScores, 
        updateDriverScore,
        filterDrivers 
    };
})();