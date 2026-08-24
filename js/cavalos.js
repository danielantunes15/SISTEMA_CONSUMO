window.cavalosModule = (function() {
    let cavalos = []; // Variável global para manter o app.js funcionando

    // Função principal que carrega e processa os dados
    async function loadCavalos() {
        try {
            // 1. Busca todos os cavalos cadastrados para obter os Conjuntos e Carretas
            const { data: cavalosData, error: errorCavalos } = await window.supabaseClient
                .from('cavalos')
                .select('*');

            if (!errorCavalos && cavalosData) {
                cavalos = cavalosData;
            }

            // 2. Busca as viagens com LOOP (Paginação) para ignorar o limite de 1000 linhas do Supabase
            let viagensData = [];
            let from = 0;
            const step = 1000;
            
            while (true) {
                const { data, error } = await window.supabaseClient
                    .from('viagens')
                    .select('placa, distancia_km')
                    .range(from, from + step - 1);
                
                if (error) {
                    console.error('Erro ao buscar viagens:', error);
                    break;
                }
                
                if (data && data.length > 0) {
                    viagensData = viagensData.concat(data);
                }
                
                // Se retornar menos de 1000 itens, significa que chegou no fim do banco de dados
                if (!data || data.length < step) {
                    break;
                }
                
                from += step;
            }

            const stats = {};
            
            // 3. Preenche a lista inicialmente com todos os Cavalos cadastrados (mesmo os com 0 KM)
            cavalos.forEach(c => {
                if (c.placa) {
                    const carretas = [c.carreta1, c.carreta2, c.carreta3].filter(x => x && x.trim() !== '').join(' / ');
                    stats[c.placa] = {
                        placa: c.placa,
                        conjunto: c.conjunto || 'S/N',
                        carretas: carretas || 'Sem carretas',
                        kmTotal: 0
                    };
                }
            });

            // 4. Soma a quilometragem lida de todas as viagens
            viagensData.forEach(item => {
                const placa = item.placa || 'NÃO IDENTIFICADO';
                const km = parseFloat(item.distancia_km) || 0;
                
                // Se o caminhão fez viagem mas não estava na tabela de cavalos, adicionamos agora
                if (!stats[placa]) {
                    stats[placa] = {
                        placa: placa,
                        conjunto: 'S/N',
                        carretas: 'Sem carretas vinculadas',
                        kmTotal: 0
                    };
                }
                stats[placa].kmTotal += km;
            });

            // 5. Converte em array e ordena do maior para o menor
            const ranking = Object.values(stats).sort((a, b) => b.kmTotal - a.kmTotal);

            // Prepara os dados para o Gráfico
            const placas = ranking.map(r => r.placa);
            const kms = ranking.map(r => r.kmTotal.toFixed(3));

            // Renderiza na tela
            renderChart(placas, kms);
            renderTable(ranking);

        } catch (err) {
            console.error('Erro inesperado ao montar o ranking:', err);
        }
        
        return cavalos;
    }

    // ==========================================
    // GRÁFICO ECHARTS
    // ==========================================
    function renderChart(placas, kms) {
        const chartDiv = document.getElementById('rankingKmChart');
        if (!chartDiv) return;

        const myChart = echarts.init(chartDiv);

        const option = {
            title: { 
                text: 'TOTAL DE KM RODADOS (POR PLACA EM ORDEM DECRESCENTE)', 
                left: 'center', 
                textStyle: { color: '#f8fafc', fontSize: 15, fontFamily: 'Inter' },
                padding: [10, 0, 20, 0]
            },
            tooltip: { 
                trigger: 'axis', 
                axisPointer: { type: 'shadow' },
                formatter: '{b}: {c} KM',
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                borderColor: '#334155',
                textStyle: { color: '#f8fafc' }
            },
            grid: { left: '2%', right: '4%', bottom: '22%', containLabel: true },
            
            // BARRA DE ROLAGEM INFERIOR (Inteligente para frotas grandes)
            dataZoom: [
                {
                    type: 'slider',
                    show: true,
                    xAxisIndex: [0],
                    start: 0,
                    end: placas.length > 15 ? 40 : 100,
                    bottom: 0,
                    textStyle: { color: '#94a3b8' },
                    borderColor: '#334155',
                    fillerColor: 'rgba(56, 189, 248, 0.2)'
                }
            ],
            xAxis: { 
                type: 'category', 
                data: placas, 
                axisLabel: { 
                    interval: 0, 
                    rotate: 45, 
                    color: '#94a3b8', 
                    fontSize: 11 
                },
                axisLine: { lineStyle: { color: '#334155' } }
            },
            yAxis: { 
                type: 'value', 
                name: 'Soma de Distância', 
                nameTextStyle: { color: '#94a3b8', padding: [0, 0, 10, 0] }, 
                axisLabel: { color: '#94a3b8' }, 
                splitLine: { lineStyle: { color: '#334155', type: 'dashed' } }
            },
            series: [{
                name: 'KM Rodados', 
                type: 'bar', 
                barMaxWidth: 45, // Impede que barras fiquem muito grossas
                data: kms, 
                itemStyle: { 
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: '#38bdf8' },
                        { offset: 1, color: '#1a6b8c' }
                    ]),
                    borderRadius: [4, 4, 0, 0]
                },
                label: { 
                    show: true, 
                    position: 'top', 
                    formatter: '{c}',
                    rotate: 90, 
                    align: 'left', 
                    verticalAlign: 'middle', 
                    offset: [0, -10], 
                    color: '#f8fafc', 
                    fontSize: 10 
                }
            }]
        };

        myChart.setOption(option);
        window.addEventListener('resize', () => myChart.resize());
    }

    // ==========================================
    // TABELA LISTA COMPLETA
    // ==========================================
    function renderTable(ranking) {
        const tbody = document.getElementById('ranking-table-list');
        if (!tbody) return;

        if (ranking.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #94a3b8; padding: 30px;">Nenhum dado de viagem encontrado.</td></tr>';
            return;
        }

        tbody.innerHTML = ranking.map((item, index) => {
            // Estilos de Destaque para o Top 3 (Ouro, Prata, Bronze)
            let posStyle = 'color: #94a3b8; font-weight: bold;';
            let icon = '';

            if (index === 0) {
                posStyle = 'color: #fbbf24; font-weight: 800; font-size: 1.1rem;';
                icon = '<i class="fas fa-trophy" style="margin-right: 5px;"></i>';
            } else if (index === 1) {
                posStyle = 'color: #cbd5e1; font-weight: 800; font-size: 1.1rem;';
            } else if (index === 2) {
                posStyle = 'color: #b45309; font-weight: 800; font-size: 1.1rem;';
            }

            let kmExibicao = item.kmTotal > 0 ? utils.formatNumber(item.kmTotal, 3) : "0,000";

            return `
            <tr style="border-bottom: 1px solid rgba(51, 65, 85, 0.4); transition: background 0.2s;" onmouseover="this.style.background='rgba(51, 65, 85, 0.3)'" onmouseout="this.style.background='transparent'">
                <td style="text-align: center; ${posStyle}">${icon}${index + 1}º</td>
                <td>
                    <strong style="color: #38bdf8; font-size: 1.05rem;">${item.placa}</strong> <span style="color: #94a3b8; font-size: 0.85rem;">(${item.conjunto})</span><br>
                    <span style="font-size: 0.75rem; color: #64748b;"><i class="fas fa-link" style="margin-right: 4px; font-size: 0.65rem;"></i>${item.carretas}</span>
                </td>
                <td style="text-align: right; font-weight: 600; padding-right: 20px;">
                    <span style="background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 6px 12px; border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.2); display: inline-block; min-width: 100px; text-align: center;">
                        ${kmExibicao} KM
                    </span>
                </td>
            </tr>
            `;
        }).join('');
    }

    // Retorna os cavalos pro app.js não quebrar no Dashboard
    function getAllCavalos() {
        return cavalos;
    }

    return { 
        load: loadCavalos,
        getAll: getAllCavalos
    };
})();