window.ocorrenciasModule = (function() {
    let ocorrencias = [];
    let chartInstance = null; 

    function getCycleInfo() {
        const s = window.settingsModule ? window.settingsModule.get() : {};
        return { startDay: s.cicloInicio || 26, endDay: s.cicloFim || 25 };
    }

    function getCycleMonthYear(dateStr, startDay, endDay) {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return null;
        const dom = d.getDate();
        let m = d.getMonth() + 1;
        let y = d.getFullYear();
        
        if (startDay > endDay && dom >= startDay) {
            m += 1;
            if (m > 12) { m = 1; y += 1; }
        }
        return `${y}-${String(m).padStart(2, '0')}`;
    }

    function isDateInCycle(dateStr, targetYear, targetMonth, startDay, endDay) {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return false;
        
        let startDate, endDate;
        if (startDay > endDay) {
            startDate = new Date(targetYear, targetMonth - 2, startDay, 0, 0, 0);
            endDate = new Date(targetYear, targetMonth - 1, endDay, 23, 59, 59);
        } else {
            startDate = new Date(targetYear, targetMonth - 1, startDay, 0, 0, 0);
            endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59); 
            if (endDay < endDate.getDate()) {
                endDate = new Date(targetYear, targetMonth - 1, endDay, 23, 59, 59);
            }
        }
        return d >= startDate && d <= endDate;
    }

    async function loadOcorrencias() {
        if (!window.rhSupabaseClient) {
            console.error("Cliente Supabase do RH não está configurado.");
            return [];
        }

        try {
            const { data, error } = await window.rhSupabaseClient
                .from('ocorrencias')
                .select('*')
                .order('data_ocorrido', { ascending: false });
            
            if (error) console.error("Erro RH Ocorrencias:", error);
            
            if (data) {
                ocorrencias = data.map(rhOc => ({
                    id: rhOc.id,
                    data: rhOc.data_ocorrido,
                    hora: rhOc.hora_ocorrido,
                    motorista: rhOc.nome_envolvido,
                    local: rhOc.local_projeto,
                    placa: rhOc.placa,
                    descricao: rhOc.descricao_fatos
                }));
            }
        } catch(e) { console.error("Erro BD RH:", e); }

        renderOcorrencias();
        renderDashboard(); 
        return ocorrencias;
    }

    function renderOcorrencias() {
        const tbody = document.getElementById('ocorrencias-list');
        if (!tbody) return;

        if (ocorrencias.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding: 20px; color: #94a3b8;">Nenhuma ocorrência encontrada.</td></tr>';
            return;
        }

        const sortedOcorrencias = [...ocorrencias].sort((a, b) => {
            const dateA = a.data ? new Date(`${a.data}T${a.hora || '00:00'}:00`).getTime() : 0;
            const dateB = b.data ? new Date(`${b.data}T${b.hora || '00:00'}:00`).getTime() : 0;
            return (dateB || 0) - (dateA || 0);
        });

        tbody.innerHTML = sortedOcorrencias.map(oc => {
            let dataFormatada = '-';
            if (oc.data) {
                const partes = oc.data.split('-');
                if (partes.length === 3) dataFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`;
            }
            let horaFormatada = '--:--';
            if (oc.hora) horaFormatada = oc.hora.length > 5 ? oc.hora.substring(0, 5) : oc.hora;

            return `
            <tr>
                <td style="font-weight: 500; color: #f8fafc;">${dataFormatada} às ${horaFormatada}</td>
                <td style="color: #e2e8f0; font-weight: 500;">${escapeHtml(oc.motorista || '-')}</td>
                <td><span class="status-badge warning">${escapeHtml(oc.placa || '-')}</span></td>
                <td>${escapeHtml(oc.local || '-')}</td>
                <td style="max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #94a3b8;" title="${escapeHtml(oc.descricao)}">${escapeHtml(oc.descricao || '-')}</td>
                <td>
                    <span class="status-badge success" style="background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid #10b981;">
                        <i class="fas fa-lock"></i> RH
                    </span>
                </td>
            </tr>`;
        }).join('');
    }

    function getAvailableMonths() {
        const { startDay, endDay } = getCycleInfo();
        const monthsSet = new Set();
        ocorrencias.forEach(oc => {
            if(oc.data) {
                const cycle = getCycleMonthYear(oc.data + 'T00:00:00', startDay, endDay);
                if (cycle) monthsSet.add(cycle);
            }
        });
        let available = Array.from(monthsSet).sort().reverse();
        if (available.length === 0) {
            const now = new Date();
            available.push(getCycleMonthYear(now.toISOString(), startDay, endDay));
        }
        return available;
    }

    function formatMonthStr(yyyy_mm) {
        const [y, m] = yyyy_mm.split('-');
        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        return `${monthNames[parseInt(m)-1]}/${y}`;
    }

    function renderDashboard() {
        const availableMonths = getAvailableMonths();
        const filterSelect = document.getElementById('dashboard-month-filter');
        
        if (filterSelect && filterSelect.options.length === 0) {
            filterSelect.innerHTML = availableMonths.map(m => `<option value="${m}">Ciclo de ${formatMonthStr(m)}</option>`).join('');
        }
        
        let selectedMonth = availableMonths[0]; 
        if (filterSelect && filterSelect.value) {
            selectedMonth = filterSelect.value;
        }
        
        const { startDay, endDay } = getCycleInfo();
        const [selYear, selMonth] = selectedMonth.split('-');

        const currentMonthOcorrencias = ocorrencias.filter(oc => {
            if(!oc.data) return false;
            return isDateInCycle(oc.data + 'T00:00:00', parseInt(selYear), parseInt(selMonth), startDay, endDay);
        });

        const totalEl = document.getElementById('oc-total');
        if (totalEl) totalEl.textContent = currentMonthOcorrencias.length;

        const motoristasCount = {};
        const locaisCount = {};

        currentMonthOcorrencias.forEach(oc => {
            if (oc.motorista) motoristasCount[oc.motorista] = (motoristasCount[oc.motorista] || 0) + 1;
            if (oc.local) locaisCount[oc.local] = (locaisCount[oc.local] || 0) + 1;
        });

        const getTop = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1])[0] || ['-', 0];
        const topMotorista = getTop(motoristasCount);
        const topLocal = getTop(locaisCount);

        const reinEl = document.getElementById('oc-reincidente');
        const localEl = document.getElementById('oc-local');

        if (reinEl) reinEl.textContent = topMotorista[1] > 0 ? `${topMotorista[0]} (${topMotorista[1]})` : '-';
        if (localEl) localEl.textContent = topLocal[1] > 0 ? `${topLocal[0]} (${topLocal[1]})` : '-';

        // Gráfico Inteligente para o Ciclo Personalizado
        let startDate, endDateCycle;
        const targetYear = parseInt(selYear);
        const targetMonth = parseInt(selMonth);
        
        if (startDay > endDay) {
            startDate = new Date(targetYear, targetMonth - 2, startDay);
            endDateCycle = new Date(targetYear, targetMonth - 1, endDay);
        } else {
            startDate = new Date(targetYear, targetMonth - 1, startDay);
            endDateCycle = new Date(targetYear, targetMonth, 0);
            if (endDay < endDateCycle.getDate()) {
                endDateCycle = new Date(targetYear, targetMonth - 1, endDay);
            }
        }

        const labels = [];
        const dataCounts = [];
        const now = new Date();
        now.setHours(0,0,0,0);
        
        let currentDate = new Date(startDate);
        while (currentDate <= endDateCycle) {
            const dStr = String(currentDate.getDate()).padStart(2, '0');
            const mStr = String(currentDate.getMonth() + 1).padStart(2, '0');
            labels.push(`${dStr}/${mStr}`);
            
            if (currentDate > now) {
                dataCounts.push(null);
            } else {
                dataCounts.push(0);
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        currentMonthOcorrencias.forEach(oc => {
            if (oc.data) {
                const parts = oc.data.split('-'); 
                const ocD = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
                
                const diffTime = ocD.getTime() - startDate.getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays >= 0 && diffDays < dataCounts.length && dataCounts[diffDays] !== null) {
                    dataCounts[diffDays]++;
                }
            }
        });

        renderChart(labels, dataCounts);
    }

    function renderChart(labels, data) {
        const canvas = document.getElementById('ocorrenciasChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        if (chartInstance) chartInstance.destroy(); 

        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.4)'); 
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0.0)'); 

        const showValuesPlugin = {
            id: 'showValues',
            afterDatasetsDraw(chart) {
                const { ctx } = chart;
                chart.data.datasets.forEach((dataset, i) => {
                    const meta = chart.getDatasetMeta(i);
                    meta.data.forEach((element, index) => {
                        const val = dataset.data[index];
                        if (val !== null && val !== undefined && element && !isNaN(element.x)) { 
                            ctx.fillStyle = val > 0 ? '#f8fafc' : '#64748b'; 
                            ctx.font = val > 0 ? 'bold 13px "Inter", sans-serif' : 'normal 11px "Inter", sans-serif';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'bottom';
                            ctx.fillText(val, element.x, element.y - 8); 
                        }
                    });
                });
            }
        };

        chartInstance = new Chart(ctx, {
            type: 'line', 
            data: {
                labels: labels,
                datasets: [{
                    label: 'Nº de Ocorrências',
                    data: data,
                    borderColor: '#ef4444',
                    borderWidth: 3,
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.4, 
                    pointBackgroundColor: '#1e293b',
                    pointBorderColor: '#ef4444',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    spanGaps: false 
                }]
            },
            plugins: [showValuesPlugin], 
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 20 } },
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#94a3b8',
                        bodyColor: '#f8fafc',
                        borderColor: '#334155',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return context.raw + (context.raw > 1 ? ' Ocorrências' : ' Ocorrência');
                            }
                        }
                    }
                },
                scales: {
                    y: { 
                        beginAtZero: true, 
                        ticks: { stepSize: 1, color: '#64748b', font: {size: 11} },
                        grid: { color: 'rgba(51, 65, 85, 0.3)', borderDash: [5, 5] },
                        border: { display: false },
                        suggestedMax: Math.max(...data.filter(n => n !== null)) + 1 
                    },
                    x: { 
                        ticks: { color: '#94a3b8', font: {size: 10}, maxTicksLimit: 15 },
                        grid: { display: false },
                        border: { display: false }
                    }
                }
            }
        });
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div'); div.textContent = text; return div.innerHTML;
    }

    function getAllOcorrencias() { return ocorrencias; }

    return { 
        load: loadOcorrencias, 
        getAll: getAllOcorrencias, 
        renderDashboard 
    };
})();