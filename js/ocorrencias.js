window.ocorrenciasModule = (function() {
    let ocorrencias = [];
    let editingId = null;
    let chartInstance = null; 

    async function loadOcorrencias() {
        try {
            // Removida a ordenação pelo Supabase para evitar bloqueios caso a coluna não exista
            const { data, error } = await window.supabaseClient.from('ocorrencias').select('*');
            
            if (error) {
                console.error("Erro ao carregar ocorrências do Supabase:", error);
            }
            if (data) {
                ocorrencias = data;
            }
        } catch(e) {
            console.error("Erro na comunicação com o banco:", e);
        }

        renderOcorrencias();
        renderDashboard(); 
        return ocorrencias;
    }

    function renderOcorrencias() {
        const tbody = document.getElementById('ocorrencias-list');
        if (!tbody) return;

        if (ocorrencias.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding: 20px; color: #94a3b8;">Nenhuma ocorrência registrada no sistema.</td></tr>';
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

            return `
            <tr>
                <td style="font-weight: 500; color: #f8fafc;">${dataFormatada} às ${oc.hora || '--:--'}</td>
                <td style="color: #e2e8f0; font-weight: 500;">${escapeHtml(oc.motorista || '-')}</td>
                <td><span class="status-badge warning">${escapeHtml(oc.placa)}</span></td>
                <td>${escapeHtml(oc.local)}</td>
                <td style="max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #94a3b8;">${escapeHtml(oc.descricao)}</td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn-primary btn-sm btn-icon" title="Editar" onclick="window.ocorrenciasModule.edit(${oc.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn-danger btn-sm btn-icon" title="Excluir" onclick="window.ocorrenciasModule.delete(${oc.id})"><i class="fas fa-trash"></i></button>
                    </div>
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

    function populatePlacasSelect() {
        const select = document.getElementById('oc-placa');
        if (!select) return;
        const cavalos = window.cavalosModule ? window.cavalosModule.getAll() : [];
        const sortedCavalos = [...cavalos].sort((a, b) => (a.placa || '').localeCompare(b.placa || ''));
        
        let optionsHtml = '<option value="">Selecione a placa...</option>';
        sortedCavalos.forEach(cavalo => {
            optionsHtml += `<option value="${cavalo.placa}">${cavalo.placa} (Conjunto: ${cavalo.conjunto})</option>`;
        });
        select.innerHTML = optionsHtml;
    }

    function populateMotoristasSelect() {
        const select = document.getElementById('oc-motorista');
        if (!select) return;
        const motoristas = window.driversModule ? window.driversModule.getAll() : [];
        const sortedMotoristas = [...motoristas].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        
        let optionsHtml = '<option value="">Selecione o motorista (Opcional)...</option>';
        sortedMotoristas.forEach(mot => {
            optionsHtml += `<option value="${mot.name}">${mot.name}</option>`;
        });
        select.innerHTML = optionsHtml;
    }

    function openModal(ocorrenciaId = null) {
        editingId = ocorrenciaId;
        const modal = document.getElementById('ocorrencia-modal');
        const title = document.getElementById('ocorrencia-modal-title');
        const form = document.getElementById('ocorrencia-form');
        
        populatePlacasSelect();
        populateMotoristasSelect();
        
        if (ocorrenciaId) {
            const oc = ocorrencias.find(o => o.id === ocorrenciaId);
            if (oc) {
                document.getElementById('oc-data').value = oc.data;
                document.getElementById('oc-hora').value = oc.hora;
                document.getElementById('oc-motorista').value = oc.motorista || '';
                document.getElementById('oc-local').value = oc.local;
                document.getElementById('oc-placa').value = oc.placa;
                document.getElementById('oc-descricao').value = oc.descricao;
                title.textContent = 'Editar Ocorrência';
            }
        } else {
            form.reset();
            const hoje = new Date();
            const yyyy = hoje.getFullYear();
            const mm = String(hoje.getMonth() + 1).padStart(2, '0');
            const dd = String(hoje.getDate()).padStart(2, '0');
            document.getElementById('oc-data').value = `${yyyy}-${mm}-${dd}`;
            title.textContent = 'Nova Ocorrência';
        }
        modal.classList.add('active');
    }

    function closeModal() {
        document.getElementById('ocorrencia-modal').classList.remove('active');
        editingId = null;
        document.getElementById('ocorrencia-form').reset();
    }

    function updateSystemViews() {
        if (window.rankingModule) window.rankingModule.render();
        if (window.app) window.app.updateDashboard();
    }

    async function saveOcorrencia(event) {
        event.preventDefault();
        const btn = event.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        const ocorrenciaData = {
            data: document.getElementById('oc-data').value,
            hora: document.getElementById('oc-hora').value,
            motorista: document.getElementById('oc-motorista').value,
            local: document.getElementById('oc-local').value,
            placa: document.getElementById('oc-placa').value,
            descricao: document.getElementById('oc-descricao').value
        };
        
        if (editingId) {
            await window.supabaseClient.from('ocorrencias').update(ocorrenciaData).eq('id', editingId);
            utils.showAlert('Ocorrência atualizada com sucesso!', 'success');
        } else {
            await window.supabaseClient.from('ocorrencias').insert([ocorrenciaData]);
            utils.showAlert('Ocorrência registrada no banco!', 'success');
        }
        
        await loadOcorrencias(); 
        closeModal();
        updateSystemViews();
        btn.disabled = false;
    }

    async function deleteOcorrencia(id) {
        if (confirm('Tem certeza que deseja excluir esta ocorrência do banco de dados?')) {
            await window.supabaseClient.from('ocorrencias').delete().eq('id', id);
            await loadOcorrencias(); 
            utils.showAlert('Ocorrência excluída com sucesso!', 'success');
            updateSystemViews();
        }
    }

    function getAllOcorrencias() { return ocorrencias; }

    document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('ocorrencia-form');
        if (form) form.addEventListener('submit', saveOcorrencia);
    });

    return { 
        load: loadOcorrencias, 
        getAll: getAllOcorrencias, 
        openModal, 
        closeModal, 
        edit: openModal, 
        delete: deleteOcorrencia,
        renderDashboard 
    };
})();