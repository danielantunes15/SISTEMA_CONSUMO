window.driversModule = (function() {
    let drivers = [];
    let editingId = null;

    // Função poderosa para padronizar nomes (remove acentos, espaços extras e deixa tudo maiúsculo)
    function normalizeStr(str) {
        if (!str) return '';
        return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
    }

    async function syncDriversFromRH() {
        if (!window.rhSupabaseClient) return;
        
        try {
            const { data: rhDrivers, error: rhError } = await window.rhSupabaseClient
                .from('rh_colaboradores')
                .select('nome, cpf, foto_url')
                .ilike('funcao', '%MOTORISTA DE TRITREM%')
                .eq('status', 'Ativo');

            if (rhError) return;
            if (!rhDrivers || rhDrivers.length === 0) return;

            // Busca motoristas locais trazendo também o CPF para cruzar os dados
            const { data: localDrivers } = await window.supabaseClient.from('motoristas').select('id, name, cpf');
            
            const localCpfs = (localDrivers || []).map(d => (d.cpf || '').replace(/\D/g, '')).filter(c => c.length > 0);
            const localNames = (localDrivers || []).map(d => normalizeStr(d.name));

            const newDrivers = [];
            const addedInThisBatch = [];
            
            for (let rh of rhDrivers) {
                const rawName = rh.nome || '';
                const rhNameNorm = normalizeStr(rawName);
                const rhCpf = (rh.cpf || '').replace(/\D/g, '');
                
                // Valida duplicidade usando as características (CPF ou Nome)
                let exists = false;
                if (rhCpf && localCpfs.includes(rhCpf)) exists = true;
                if (rhNameNorm && localNames.includes(rhNameNorm)) exists = true;
                if (rhNameNorm && addedInThisBatch.includes(rhNameNorm)) exists = true;

                if (!exists && rhNameNorm) {
                    newDrivers.push({
                        name: rawName.trim().toUpperCase(),
                        cpf: rh.cpf || '',
                        foto: rh.foto_url || '',
                        occurrences: 0,
                        score: 0,
                        total_distance: 0,
                        total_fuel: 0,
                        avg_economy: 0,
                        last_reset: new Date().toISOString()
                    });
                    addedInThisBatch.push(rhNameNorm);
                    if (rhCpf) localCpfs.push(rhCpf);
                }
            }

            if (newDrivers.length > 0) {
                await window.supabaseClient.from('motoristas').insert(newDrivers);
            }
        } catch (error) {
            console.error("Erro geral na sincronização com o RH:", error);
        }
    }

    async function loadDrivers() {
        await syncDriversFromRH();

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
            const driverNameNorm = normalizeStr(driver.name);
            
            const dTrips = allTrips.filter(t => normalizeStr(t.motorista) === driverNameNorm);
            const dOcorrencias = allOcorrencias.filter(oc => normalizeStr(oc.motorista) === driverNameNorm);
            
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
                        <button class="btn-danger btn-sm btn-icon" title="Excluir" onclick="window.driversModule.deleteDriver(${driver.id})"><i class="fas fa-trash"></i></button>
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
        if (!text) return '';
        const div = document.createElement('div'); div.textContent = text; return div.innerHTML;
    }

    function openModal(driverId = null) {
        if (typeof driverId === 'object') driverId = null;
        editingId = driverId;
        
        const modal = document.getElementById('driver-modal');
        const title = document.getElementById('modal-title');
        const preview = document.getElementById('foto-preview');
        
        if (editingId) {
            const driver = drivers.find(d => d.id === editingId);
            if (driver) {
                document.getElementById('driver-name').value = driver.name;
                document.getElementById('driver-cpf').value = driver.cpf;
                document.getElementById('driver-matricula').value = driver.matricula || '';
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
            name: document.getElementById('driver-name').value.trim().toUpperCase(),
            cpf: document.getElementById('driver-cpf').value,
            matricula: document.getElementById('driver-matricula').value,
            foto: document.getElementById('driver-foto-base64').value
        };

        if (editingId) {
            const oldDriver = drivers.find(d => d.id === editingId);
            await window.supabaseClient.from('motoristas').update(driverData).eq('id', editingId);
            
            if (oldDriver && normalizeStr(oldDriver.name) !== normalizeStr(driverData.name)) {
                await window.supabaseClient.from('viagens')
                    .update({ motorista: driverData.name })
                    .ilike('motorista', oldDriver.name);
            }
            
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
        
        if (window.tripsModule) await window.tripsModule.load();
        
        btn.disabled = false;
    }

    async function deleteDriver(id) {
        if (confirm('Tem certeza que deseja excluir este motorista? Os dados não poderão ser desfeitos.')) {
            await window.supabaseClient.from('motoristas').delete().eq('id', id);
            await loadDrivers();
            utils.showAlert('Motorista excluído!', 'success');
            if (window.tripsModule) window.tripsModule.updateDriverStats();
        }
    }

    // ==========================================
    // LÓGICA DO PAINEL DE DUPLICADOS
    // ==========================================
    
    // Algoritmo matemático para medir similaridade entre strings
    function getLevenshteinDistance(a, b) {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
                }
            }
        }
        return matrix[b.length][a.length];
    }

    function areNamesSimilar(name1, name2) {
        const n1 = normalizeStr(name1);
        const n2 = normalizeStr(name2);
        if (n1 === n2) return true;
        
        // 1. Um nome está inteiramente contido dentro do outro (ex: JOAO SILVA e JOAO DA SILVA)
        if (n1.includes(n2) || n2.includes(n1)) return true;
        
        // 2. Tolerância a pequenos erros de digitação (até 3 letras diferentes em nomes compridos)
        const dist = getLevenshteinDistance(n1, n2);
        if (dist <= 3 && Math.max(n1.length, n2.length) > 10) return true;
        
        return false;
    }

    function openDuplicatesModal() {
        const modal = document.getElementById('duplicates-modal');
        const listContainer = document.getElementById('duplicates-list');
        listContainer.innerHTML = '<div style="text-align:center; color:#94a3b8; padding: 30px;"><i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 15px;"></i><br>Analisando nomes da base de dados...</div>';
        modal.classList.add('active');

        // Um pequeno delay apenas para a interface desenhar o modal antes do processamento pesado
        setTimeout(() => {
            renderDuplicatesList(listContainer);
        }, 150);
    }

    function closeDuplicatesModal() {
        document.getElementById('duplicates-modal').classList.remove('active');
    }

    function renderDuplicatesList(container) {
        const groups = [];
        const processed = new Set();
        
        for (let i = 0; i < drivers.length; i++) {
            if (processed.has(drivers[i].id)) continue;
            
            const similarGroup = [drivers[i]];
            for (let j = i + 1; j < drivers.length; j++) {
                if (processed.has(drivers[j].id)) continue;
                
                // Se o nome for detectado como duplicado / parecido
                if (areNamesSimilar(drivers[i].name, drivers[j].name)) {
                    similarGroup.push(drivers[j]);
                    processed.add(drivers[j].id);
                }
            }
            // Só adiciona o grupo se houver mais de uma pessoa parecida nele
            if (similarGroup.length > 1) {
                groups.push(similarGroup);
            }
        }
        
        if (groups.length === 0) {
            container.innerHTML = '<div class="alert alert-success" style="justify-content: center;"><i class="fas fa-check-circle"></i> Parabéns! Nenhum motorista com nome duplicado ou parecido foi encontrado. Seu banco de dados está limpo.</div>';
            return;
        }

        // Pega todas as viagens para podermos calcular o KM individual de cada duplicata
        const allTrips = window.tripsModule ? window.tripsModule.getAll() : [];

        let html = '';
        groups.forEach((group, index) => {
            html += `<div style="background: rgba(15, 23, 42, 0.6); border: 1px solid #334155; border-radius: 12px; padding: 15px; margin-bottom: 15px;">`;
            html += `<h4 style="color: #fbbf24; margin-bottom: 10px; font-size: 1rem;"><i class="fas fa-users" style="margin-right: 5px;"></i> Conflito #${index + 1}</h4>`;
            html += `<table style="width: 100%; border-collapse: collapse;">`;
            
            // Cabeçalho da Tabela
            html += `
                <thead>
                    <tr style="border-bottom: 1px solid #334155; text-align: left; color: #94a3b8; font-size: 0.75rem; text-transform: uppercase;">
                        <th style="padding: 8px 5px;">Nome / Cadastro</th>
                        <th style="padding: 8px 5px;">CPF</th>
                        <th style="padding: 8px 5px;">KM Total (Base)</th>
                        <th style="padding: 8px 5px; text-align: right;">Ação</th>
                    </tr>
                </thead>
                <tbody>
            `;
            
            group.forEach(d => {
                // Filtra as viagens EXATAMENTE para o nome desta duplicata
                const dNameNorm = normalizeStr(d.name);
                const dTrips = allTrips.filter(t => normalizeStr(t.motorista) === dNameNorm);
                
                let distTotal = 0;
                dTrips.forEach(t => { 
                    distTotal += parseFloat(t.distancia_km) || 0; 
                });

                html += `
                <tr style="border-bottom: 1px solid rgba(51, 65, 85, 0.4);">
                    <td style="padding: 12px 5px; color: #f8fafc; font-weight: 600; font-size: 0.95rem;">${escapeHtml(d.name)}</td>
                    <td style="padding: 12px 5px; color: #94a3b8; font-size: 0.85rem;"><i class="fas fa-id-card"></i> ${d.cpf ? utils.formatCPF(d.cpf) : 'S/ CPF'}</td>
                    <td style="padding: 12px 5px; color: #38bdf8; font-weight: 600; font-size: 0.90rem;">${utils.formatNumber(distTotal, 0)} km</td>
                    <td style="padding: 12px 5px; text-align: right;">
                        <button class="btn-danger btn-sm" onclick="window.driversModule.deleteDuplicate(${d.id})" style="padding: 6px 12px; font-size: 0.8rem;">
                            <i class="fas fa-trash"></i> Excluir
                        </button>
                    </td>
                </tr>`;
            });
            html += `</tbody></table></div>`;
        });
        
        container.innerHTML = html;
    }

    async function deleteDuplicate(id) {
        if (confirm('Tem certeza que deseja excluir esta duplicata?')) {
            await window.supabaseClient.from('motoristas').delete().eq('id', id);
            await loadDrivers();
            utils.showAlert('Duplicata removida e cadastro limpo!', 'success');
            
            // Recarrega a lista do modal para refletir a remoção instantaneamente
            const listContainer = document.getElementById('duplicates-list');
            if (listContainer) renderDuplicatesList(listContainer);
            if (window.tripsModule) window.tripsModule.updateDriverStats();
        }
    }

    // ==========================================
    // SISTEMA DE PONTUAÇÃO
    // ==========================================
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
        
        const driverNameNorm = normalizeStr(driver.name);
        const driverTrips = trips.filter(t => normalizeStr(t.motorista) === driverNameNorm);
        
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
        deleteDriver: deleteDriver,
        delete: deleteDriver, 
        addOccurrence, 
        updateScores: updateAllScores, 
        updateDriverScore,
        filterDrivers,
        openDuplicatesModal,
        closeDuplicatesModal,
        deleteDuplicate
    };
})();