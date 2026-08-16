window.tripsModule = (function() {
    let trips = [];
    let currentPageHistorico = 1;
    const itemsPerPage = 50;

    async function loadTrips(startDate = null, endDate = null) {
        utils.showAlert('<i class="fas fa-circle-notch fa-spin"></i> Sincronizando base de dados. Aguarde...', 'info');
        let allData = [];
        let hasMore = true;
        let page = 0;
        const pageSize = 1000;

        while (hasMore) {
            let query = window.supabaseClient.from('viagens').select('*');
            
            if (startDate && endDate) {
                query = query.gte('inicio', startDate).lte('inicio', endDate);
            }
            
            const from = page * pageSize;
            const to = from + pageSize - 1;
            const { data, error } = await query
                .range(from, to)
                .order('inicio', { ascending: false });
                
            if (error) {
                console.error("Erro ao carregar viagens:", error);
                utils.showAlert('Erro de conexão com o banco de dados.', 'error');
                break;
            }
            
            if (data && data.length > 0) {
                allData = allData.concat(data);
                page++;
                if (data.length < pageSize) {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
        }
        
        trips = allData;
        currentPageHistorico = 1;

        renderTrips();
        renderRecentTrips();
        renderHistorico();
        
        if (trips.length > 0) {
            utils.showAlert(`<i class="fas fa-check-circle"></i> ${trips.length} viagens carregadas com sucesso!`, 'success');
        }
        
        return trips;
    }

    function getGoalColor(kml) {
        const goal = window.settingsModule ? (window.settingsModule.get().globalGoal || 3.0) : 3.0;
        const roundedKml = parseFloat(parseFloat(kml).toFixed(2));
        return roundedKml > 0 ? (roundedKml < goal ? '#f87171' : '#10b981') : '#94a3b8';
    }

    function renderTrips() {
        const tbody = document.getElementById('trips-list');
        if (!tbody) return;

        const recentTrips = trips.slice(0, 20);
        tbody.innerHTML = recentTrips.map(trip => `
            <tr>
                <td style="font-weight: 500; color: #f8fafc;">${escapeHtml(trip.motorista || '-')}</td>
                <td>${utils.formatNumber(trip.distancia_km)}</td>
                <td style="color: ${getGoalColor(trip.kml)}; font-weight: 600;">${utils.formatNumber(trip.kml)}</td>
                <td>${utils.formatNumber(trip.total_litros)}</td>
                <td>${utils.formatDate(trip.inicio)}</td>
            </tr>
        `).join('');

        const tripCount = document.getElementById('trip-count');
        if (tripCount) tripCount.textContent = `${trips.length} registros válidos`;
    }

    function renderRecentTrips() {
        const tbody = document.getElementById('recent-trips');
        if (!tbody) return;

        const recentTrips = trips.slice(0, 10);
        tbody.innerHTML = recentTrips.map(trip => `
            <tr>
                <td style="font-weight: 500; color: #f8fafc;">${escapeHtml(trip.motorista || '-')}</td>
                <td>${utils.formatNumber(trip.distancia_km)}</td>
                <td style="color: ${getGoalColor(trip.kml)}; font-weight: 600;">${utils.formatNumber(trip.kml)}</td>
                <td>${utils.formatNumber(trip.total_litros)}</td>
                <td>${utils.formatDate(trip.inicio)}</td>
            </tr>
        `).join('');
    }

    function renderHistorico() {
        const tbody = document.getElementById('historico-list');
        if (!tbody) return;
        const totalItems = trips.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
        if (currentPageHistorico > totalPages) currentPageHistorico = totalPages;
        if (currentPageHistorico < 1) currentPageHistorico = 1;
        const startIndex = (currentPageHistorico - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const tripsToRender = trips.slice(startIndex, endIndex);
        
        tbody.innerHTML = tripsToRender.map(trip => `
            <tr>
                <td style="font-weight: 500; color: #f8fafc;">${escapeHtml(trip.motorista || '-')}</td>
                <td>${utils.formatDateTime(trip.inicio)}</td>
                <td>${utils.formatDateTime(trip.fim)}</td>
                <td>${utils.formatNumber(trip.distancia_km)}</td>
                <td style="color: ${getGoalColor(trip.kml)}; font-weight: 600;">${utils.formatNumber(trip.kml)}</td>
                <td>${utils.formatNumber(trip.total_litros)}</td>
            </tr>
        `).join('');

        const countBadge = document.getElementById('historico-count');
        if (countBadge) countBadge.textContent = `${totalItems} registros globais`;
        renderPaginationControls(totalPages);
    }

    function renderPaginationControls(totalPages) {
        const historicoPage = document.querySelector('.content-area');
        if (!historicoPage) return;
        let paginationDiv = document.getElementById('historico-pagination');
        if (!paginationDiv) {
            paginationDiv = document.createElement('div');
            paginationDiv.id = 'historico-pagination';
            paginationDiv.style.cssText = 'display: flex; justify-content: center; gap: 15px; margin-top: 20px; align-items: center; padding-bottom: 20px;';
            const tableCard = document.getElementById('historico-page') ? document.getElementById('historico-page').querySelector('.table-card') : document.querySelector('.table-card');
            if (tableCard) tableCard.appendChild(paginationDiv);
        }
        paginationDiv.innerHTML = `
            <button class="btn-secondary btn-sm" id="btn-prev-page" style="width: 100px; ${currentPageHistorico === 1 ? 'opacity: 0.5; cursor: not-allowed;' : ''}" ${currentPageHistorico === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i> Anterior
            </button>
            <span style="color: #94a3b8; font-weight: 600; font-size: 0.9rem; min-width: 100px; text-align: center;">
                Página ${currentPageHistorico} de ${totalPages}
            </span>
            <button class="btn-secondary btn-sm" id="btn-next-page" style="width: 100px; ${currentPageHistorico === totalPages ? 'opacity: 0.5; cursor: not-allowed;' : ''}" ${currentPageHistorico === totalPages ? 'disabled' : ''}>
                Próxima <i class="fas fa-chevron-right"></i>
            </button>
        `;
        const btnPrev = document.getElementById('btn-prev-page');
        const btnNext = document.getElementById('btn-next-page');
        if (btnPrev) {
            btnPrev.onclick = () => {
                if (currentPageHistorico > 1) {
                    currentPageHistorico--;
                    renderHistorico();
                }
            };
        }
        if (btnNext) {
            btnNext.onclick = () => {
                if (currentPageHistorico < totalPages) {
                    currentPageHistorico++;
                    renderHistorico();
                }
            };
        }
    }

    function escapeHtml(text) {
        if (!text) return '-';
        const div = document.createElement('div'); div.textContent = text; return div.innerHTML;
    }

    async function importFromExcel(data) {
        const supabaseData = data.map(t => ({
            motorista: t.motorista,
            placa: t.placa,
            distancia_km: t['Distância (Km)'],
            kml: t['Km/l'],
            total_litros: t['Total Litros Consumido'],
            inicio: t.inicio,
            fim: t.fim
        }));
        
        utils.showAlert(`<i class="fas fa-cloud-upload-alt"></i> Salvando ${supabaseData.length} viagens. Por favor, aguarde...`, 'info');
        
        const batchSize = 500;
        let hasError = false;
        
        for (let i = 0; i < supabaseData.length; i += batchSize) {
            const batch = supabaseData.slice(i, i + batchSize);
            
            // Alterado de .insert para .upsert para lidar com as duplicatas de forma inteligente
            const { error } = await window.supabaseClient
                .from('viagens')
                .upsert(batch, { onConflict: 'motorista,inicio', ignoreDuplicates: true });
                
            if (error) {
                console.error(error);
                hasError = true;
            }
        }
        
        if (hasError) {
            utils.showAlert('Ocorreu um erro ao importar alguns lotes para o banco de dados.', 'error');
        } else {
            await loadTrips(); // Removido recarregamento mensal, carrega tudo após importação
            updateDriverStats();
            utils.showAlert(`<i class="fas fa-check-double"></i> Viagens processadas com sucesso! Duplicadas foram ignoradas.`, 'success');
        }
    }

    function updateDriverStats() {
        if (window.driversModule) window.driversModule.updateScores();
        if (window.rankingModule) window.rankingModule.render();
        if (window.app) window.app.updateDashboard();
    }

    function getAllTrips() { return trips; }
    
    function getDriverTrips(driverName) { return trips.filter(t => t.motorista === driverName); }
    
    function setupUpload() {
        const uploadArea = document.getElementById('uploadArea');
        const excelInput = document.getElementById('excel-input');
        if (!uploadArea || !excelInput) return;
        
        uploadArea.addEventListener('click', () => excelInput.click());
        uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.style.borderColor = '#3b82f6'; });
        uploadArea.addEventListener('dragleave', () => { uploadArea.style.borderColor = '#475569'; });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault(); uploadArea.style.borderColor = '#475569';
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
        });
        excelInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) handleFile(file);
        });
    }

    function parseExcelNumber(val) {
        if (val === undefined || val === null || val === '') return 0;
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
            let cleanStr = val.trim().replace(/[R$\s]/g, '');
            if (cleanStr.includes('.') && cleanStr.includes(',')) cleanStr = cleanStr.replace(/\./g, '');
            cleanStr = cleanStr.replace(',', '.');
            const parsed = parseFloat(cleanStr);
            return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
    }

    function parseKML(val) {
        let parsed = parseExcelNumber(val);
        if (parsed > 15) parsed = parsed / 100;
        return parsed;
    }

    function parseDateString(dateStr) {
        let isoDate = new Date().toISOString();
        if (!dateStr) return isoDate;
        if (typeof dateStr === 'string') {
            if (dateStr.includes('/')) {
                const parts = dateStr.split(' ');
                const dateParts = parts[0].split('/');
                if (dateParts.length === 3) {
                    const dia = dateParts[0].padStart(2, '0');
                    const mes = dateParts[1].padStart(2, '0');
                    let ano = dateParts[2];
                    if (ano.length === 2) ano = '20' + ano;
                    let time = '12:00:00';
                    if (parts.length > 1) {
                        time = parts[1];
                        if (time.split(':').length === 2) time += ':00';
                    }
                    try { isoDate = new Date(`${ano}-${mes}-${dia}T${time}`).toISOString(); } catch(e) {}
                }
            } else {
                try { isoDate = new Date(dateStr).toISOString(); } catch(err) {}
            }
        } else if (dateStr instanceof Date) {
            isoDate = dateStr.toISOString();
        }
        return isoDate;
    }

    function handleFile(file) {
        utils.showAlert('<i class="fas fa-cog fa-spin"></i> Analisando arquivo Excel, isso pode levar alguns segundos...', 'info');
        
        setTimeout(() => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: false });
                
                let rawTrips = jsonData.map(row => {
                    const kmlValue = row['Km/L'] || row['Km/l'] || row['KM/L'] || row['km/l'] || 0;
                    const distanciaValue = row['Distância (Km)'] || row['Distancia (Km)'] || row['distância (km)'] || 0;
                    const litrosValue = row['Total Litros Consumido'] || row['total litros consumido'] || 0;
                    const dataInicioRaw = row.Início || row.inicio || row['Data Inicial'] || row['Dt Início'];
                    const dataFimRaw = row.Fim || row.fim || row['Data Fim'] || row['Dt Fim Descar Fáb'];
                    const placaValue = row.Placa || row.placa || row['Veículo'] || row['Equipamento'] || row.Cavalo || row.cavalo || row.Frota || null;
                    return {
                        motorista: row.Motorista || row.motorista,
                        placa: placaValue,
                        'Distância (Km)': parseExcelNumber(distanciaValue),
                        'Km/l': parseKML(kmlValue),
                        'Total Litros Consumido': parseExcelNumber(litrosValue),
                        inicio: parseDateString(dataInicioRaw),
                        fim: parseDateString(dataFimRaw),
                        Transportador: row['Transportador'] || row['Transportadora'],
                        Carregador: row['Carregador'] || row['Carregador Florestal']
                    };
                });
                
                const processedTrips = rawTrips.filter(trip => {
                    const motoristaNome = String(trip.motorista || '').trim().toUpperCase();
                    if (!motoristaNome || 
                        motoristaNome === '-' || 
                        motoristaNome === 'BENILTON SANTOS DE OLIVEIRA' || 
                        motoristaNome === 'JULIO CESAR ALMEIDA NUNES') {
                        return false; 
                    }
                    const distancia = trip['Distância (Km)'];
                    if (distancia < 10) return false;
                    
                    const transp = String(trip['Transportador'] || '').toUpperCase();
                    const carreg = String(trip['Carregador'] || '').toUpperCase();
                    const temColunaTransp = trip.Transportador !== undefined;
                    const temColunaCarreg = trip.Carregador !== undefined;
                    
                    if (temColunaTransp || temColunaCarreg) {
                        if (!transp.includes('SERRANALOG') && !carreg.includes('SERRANALOG')) return false;
                    }
                    
                    return true;
                });
                
                if (rawTrips.length > 0 && processedTrips.length === 0) {
                    utils.showAlert('Nenhuma viagem válida encontrada. Verifique se as regras batem (Motoristas, Transportadora e Distância).', 'warning');
                } else if (processedTrips.length > 0) {
                    importFromExcel(processedTrips);
                }
            };
            reader.readAsArrayBuffer(file);
        }, 300);
    }

    document.addEventListener('DOMContentLoaded', setupUpload);
    
    return { 
        load: loadTrips, 
        getAll: getAllTrips, 
        getDriverTrips, 
        importFromExcel, 
        updateDriverStats, 
        renderTrips,
        renderRecentTrips,
        renderHistorico 
    };
})();