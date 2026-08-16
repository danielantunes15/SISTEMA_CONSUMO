window.ocorrenciasModule = (function() {
    let ocorrencias = [];
    let chartInstance = null; 

    // Nova função que puxa direto do banco de dados do RH
    async function loadOcorrencias() {
        if (!window.rhSupabaseClient) {
            console.error("Cliente Supabase do RH não está configurado.");
            return [];
        }

        try {
            // Puxa as ocorrências do RH ordenadas pelas mais recentes
            const { data, error } = await window.rhSupabaseClient
                .from('ocorrencias')
                .select('*')
                .order('data_ocorrido', { ascending: false });
            
            if (error) {
                console.error("Erro ao carregar ocorrências do Supabase do RH:", error);
            }
            
            if (data) {
                // Mapeia as colunas do RH para o padrão que o sistema de frota já entende
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
        } catch(e) {
            console.error("Erro na comunicação com o banco do RH:", e);
        }

        renderOcorrencias();
        renderDashboard(); 
        return ocorrencias;
    }

    function renderOcorrencias() {
        const tbody = document.getElementById('ocorrencias-list');
        if (!tbody) return;

        if (ocorrencias.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding: 20px; color: #94a3b8;">Nenhuma ocorrência encontrada no sistema do RH.</td></tr>';
            return;
        }

        // Ordenação segura feita diretamente no JavaScript
        const sortedOcorrencias = [...ocorrencias].sort((a, b) => {
            const dateA = a.data ? new Date(`${a.data}T${a.hora || '00:00'}:00`).getTime() : 0;
            const dateB = b.data ? new Date(`${b.data}T${b.hora || '00:00'}:00`).getTime() : 0;
            return (dateB || 0) - (dateA || 0);
        });

        tbody.innerHTML = sortedOcorrencias.map(oc => {
            // Formatação de data à prova de falhas
            let dataFormatada = '-';
            if (oc.data) {
                const partes = oc.data.split('-');
                if (partes.length === 3) dataFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`;
            }
            
            // Remove os segundos da hora, se existirem (ex: 14:30:00 vira 14:30)
            let horaFormatada = '--:--';
            if (oc.hora) {
                horaFormatada = oc.hora.length > 5 ? oc.hora.substring(0, 5) : oc.hora;
            }

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
        const monthsSet = new Set();
        ocorrencias.forEach(oc => {
            if(oc.data) {
                const partes = oc.data.split('-');
                if (partes.length >= 2) {
                    monthsSet.add(`${partes[0]}-${partes[1]}`);
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
        return `${monthNames[parseInt(m)-1]}/${y}`;
    }

    function renderDashboard() {
        const availableMonths = getAvailableMonths();
        const filterSelect = document.getElementById('dashboard-month-filter');
        
        if (filterSelect && filterSelect.options.length === 0) {
            filterSelect.innerHTML = availableMonths.map(m => `<option value="${m}">${formatMonthStr(m)}</option>`).join('');
        }
        
        let selectedMonth = availableMonths[0]; 
        if (filterSelect && filterSelect.value) {
            selectedMonth = filterSelect.value;
        }
        
        const [selYear, selMonth] = selectedMonth.split('-');

        const currentMonthOcorrencias = ocorrencias.filter(oc => {
            if(!oc.data) return false;
            const partes = oc.data.split('-');
            return partes[0] == selYear && partes[1] == selMonth;
        });

        // 1. Atualizar KPIs do Mês
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

        // 2. Preparar Dados Diários
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const currentDay = now.getDate();
        
        const daysInMonth = new Date(selYear, selMonth, 0).getDate();
        const labels = [];
        const dataCounts = [];

        for (let i = 1; i <= daysInMonth; i++) {
            labels.push(`${String(i).padStart(2, '0')}/${selMonth}`);
            
            if (parseInt(selYear) === currentYear && parseInt(selMonth) === currentMonth && i > currentDay) {
                dataCounts.push(null);
            } else {
                dataCounts.push(0); 
            }
        }

        currentMonthOcorrencias.forEach(oc => {
            if (oc.data) {
                const dayIndex = parseInt(oc.data.split('-')[2]) - 1; 
                if (dayIndex >= 0 && dayIndex < daysInMonth && dataCounts[dayIndex] !== null) {
                    dataCounts[dayIndex]++;
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