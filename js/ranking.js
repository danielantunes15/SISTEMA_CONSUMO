window.rankingModule = (function() {
    function getAvailableMonths(trips) {
        const monthsSet = new Set();
        trips.forEach(t => {
            if(t.inicio) {
                const d = new Date(t.inicio);
                if(!isNaN(d.getTime())) {
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const y = d.getFullYear();
                    monthsSet.add(`${y}-${m}`);
                }
            }
        });
        let available = Array.from(monthsSet).sort().reverse();
        if (available.length === 0) {
            const d = new Date();
            available.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
        return available;
    }

    function formatMonthStr(yyyy_mm) {
        const [y, m] = yyyy_mm.split('-');
        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        return `${monthNames[parseInt(m)-1]}/${y.substring(2)}`;
    }

    function render() {
        const drivers = window.driversModule ? window.driversModule.getAll() : [];
        const ocorrencias = window.ocorrenciasModule ? window.ocorrenciasModule.getAll() : [];
        const allTrips = window.tripsModule ? window.tripsModule.getAll() : [];
        
        const parseNumber = (val) => {
            if (!val) return 0;
            return parseFloat(String(val).replace(',', '.')) || 0;
        };
        const goal = window.settingsModule ? parseNumber(window.settingsModule.get().globalGoal || 1.8) : 1.8;
        const getColor = (kml) => {
            const numKml = parseNumber(kml);
            if (numKml <= 0) return '#94a3b8';
            const roundedKml = Number(numKml.toFixed(2));
            const roundedGoal = Number(goal.toFixed(2));
            if (roundedKml >= roundedGoal) return '#10b981';
            return '#f87171';
        };

        const availableMonths = getAvailableMonths(allTrips);
        let selectedMonth = availableMonths[0]; 
        const filterSelect = document.getElementById('ranking-month-filter');
        if (filterSelect && filterSelect.value) {
            selectedMonth = filterSelect.value;
        }

        const [selYear, selMonth] = selectedMonth.split('-');
        const DISTANCIA_MINIMA_QUALIFICACAO = 1000;

        const currentMonthTrips = allTrips.filter(t => {
            if(!t.inicio) return false;
            const d = new Date(t.inicio);
            return d.getFullYear() == selYear && (d.getMonth() + 1) == selMonth;
        });

        const currentMonthOcorrencias = ocorrencias.filter(oc => {
            if(!oc.data) return false;
            const d = new Date(oc.data + 'T00:00:00');
            return d.getFullYear() == selYear && (d.getMonth() + 1) == selMonth;
        });

        const driversStats = drivers.map(driver => {
            const dTrips = currentMonthTrips.filter(t => t.motorista === driver.name);
            let dist = 0; let fuel = 0;
            dTrips.forEach(t => {
                dist += parseFloat(t.distancia_km) || 0;
                fuel += parseFloat(t.total_litros) || 0;
            });
            const kml = fuel > 0 ? dist / fuel : 0;
            const hasOcorrencia = currentMonthOcorrencias.some(oc => oc.motorista === driver.name);
            
            return {
                ...driver,
                calc_distance: dist,
                calc_kml: kml,
                has_ocorrencia: hasOcorrencia
            };
        });

        const eligibleDrivers = driversStats.filter(d => {
            if (d.calc_distance < DISTANCIA_MINIMA_QUALIFICACAO) return false;
            if (d.has_ocorrencia) return false;
            return true;
        });

        const maxDistance = Math.max(...eligibleDrivers.map(d => d.calc_distance), 1);
        const maxKML = Math.max(...eligibleDrivers.map(d => d.calc_kml), 1);
        const PESO_KML = 0.70;
        const PESO_DIST = 0.30;

        eligibleDrivers.forEach(d => {
            const kmlRatio = d.calc_kml / maxKML;
            const distRatio = d.calc_distance / maxDistance;
            d.indiceDesempenho = Math.round(((kmlRatio * PESO_KML) + (distRatio * PESO_DIST)) * 1000);
        });
        
        const sortedDrivers = [...eligibleDrivers]
            .sort((a, b) => (b.indiceDesempenho || 0) - (a.indiceDesempenho || 0))
            .slice(0, 10);
            
        const rankingContainer = document.getElementById('ranking-list');
        if (!rankingContainer) return;
        
        let html = `
            <div style="display: flex; justify-content: center; align-items: center; gap: 10px; margin-bottom: 30px; border-bottom: 1px solid #334155; padding-bottom: 20px;">
                <label style="color: #94a3b8; font-weight: 600;"><i class="fas fa-calendar-alt"></i> Visualizando Mês:</label>
                <select id="ranking-month-filter" class="form-control filter-input" style="width: 150px; font-weight: bold; background: #1e293b; text-align: center; color: #fbbf24; border-color: #fbbf24;" onchange="window.rankingModule.render()">
                    ${availableMonths.map(m => `<option value="${m}" ${m === selectedMonth ? 'selected' : ''}>${formatMonthStr(m)}</option>`).join('')}
                </select>
            </div>
        `;

        if (sortedDrivers.length === 0) {
            html += `<div style="text-align: center; padding: 3rem; color: #94a3b8;"><i class="fas fa-folder-open" style="font-size: 3rem; color: #475569; margin-bottom: 1rem;"></i><p>Nenhum motorista bateu as metas de qualificação neste mês específico.</p></div>`;
            rankingContainer.innerHTML = html;
            return;
        }
        
        html += '<div class="podium-wrapper"><div class="podium-container">';
        
        const top5 = sortedDrivers.slice(0, 5);
        const podiumOrder = [];
        if(top5[3]) podiumOrder.push({driver: top5[3], rank: 4});
        if(top5[1]) podiumOrder.push({driver: top5[1], rank: 2});
        if(top5[0]) podiumOrder.push({driver: top5[0], rank: 1});
        if(top5[2]) podiumOrder.push({driver: top5[2], rank: 3});
        if(top5[4]) podiumOrder.push({driver: top5[4], rank: 5});
        
        podiumOrder.forEach(item => {
            const d = item.driver;
            const r = item.rank;
            html += `
                <div class="podium-card rank-${r}">
                    <div class="rank-badge">${r}</div>
                    <div class="podium-avatar">
                        ${d.foto ? `<img src="${d.foto}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">` : `<i class="fas fa-user"></i>`}
                    </div>
                    <div class="podium-name">${escapeHtml(d.name)}</div>
                    <div class="podium-main-stat" style="color: #38bdf8;">${d.indiceDesempenho} <span style="font-size: 1rem; color: #94a3b8;">pts</span></div>
                    <div class="podium-stats">
                        <div class="p-stat"><span>Média</span><strong style="color: ${getColor(d.calc_kml)};">${utils.formatNumber(d.calc_kml)} km/L</strong></div>
                        <div class="p-stat"><span>Distância</span><strong>${utils.formatNumber(d.calc_distance, 0)} km</strong></div>
                    </div>
                </div>
            `;
        });
        html += '</div></div>';
        
        const remaining = sortedDrivers.slice(5);
        if (remaining.length > 0) {
            html += '<div style="margin-top: 20px; max-width: 800px; margin-left: auto; margin-right: auto;">';
            remaining.forEach((driver, idx) => {
                html += `
                    <div class="ranking-list-item">
                        <div class="ranking-list-pos">${idx + 6}</div>
                        <div class="ranking-list-info">
                            <div class="ranking-list-name">${escapeHtml(driver.name)}</div>
                            <div class="ranking-list-stats">
                                <span style="color: ${getColor(driver.calc_kml)}; font-weight: bold;"><i class="fas fa-tachometer-alt"></i> ${utils.formatNumber(driver.calc_kml)} km/L</span>
                                <span><i class="fas fa-road"></i> ${utils.formatNumber(driver.calc_distance, 0)} km</span>
                            </div>
                        </div>
                        <div class="ranking-list-score" title="Pontuação">${driver.indiceDesempenho} pts</div>
                    </div>
                `;
            });
            html += '</div>';
        }

        rankingContainer.innerHTML = html;
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div'); div.textContent = text; return div.innerHTML;
    }
    
    return { render };
})();