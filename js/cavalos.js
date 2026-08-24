window.cavalosModule = (function() {
    let cavalos = []; // Variável global restaurada para o app.js não dar erro

    // Função principal que carrega e processa os dados
    async function loadRanking() {
        try {
            // 1. PRIMEIRO: Busca TODOS os cavalos cadastrados (para não faltar nenhum)
            const { data: cavalosData, error: errorCavalos } = await window.supabaseClient
                .from('cavalos')
                .select('*');

            if (errorCavalos) {
                console.error('Erro ao buscar cavalos:', errorCavalos);
            } else if (cavalosData) {
                cavalos = cavalosData; // Alimenta a variável global para o getAll() funcionar
            }

            // 2. SEGUNDO: Busca as quilometragens na tabela de viagens
            const { data: viagensData, error: errorViagens } = await window.supabaseClient
                .from('viagens') 
                .select('placa, distancia_km');

            if (errorViagens) {
                console.error('Erro ao buscar dados de viagens:', errorViagens);
            }

            const kmPorPlaca = {};
            
            // 3. TERCEIRO: Garante que todos os cavalos cadastrados apareçam na lista (começando com 0 km)
            cavalos.forEach(c => {
                if (c.placa) {
                    kmPorPlaca[c.placa] = 0;
                }
            });

            // 4. QUARTO: Soma os KMs por placa baseados nas viagens
            (viagensData || []).forEach(item => {
                const placa = item.placa || 'NÃO IDENTIFICADO'; 
                const km = parseFloat(item.distancia_km) || 0;

                // Se houver uma placa na viagem que não estava cadastrada nos cavalos, adiciona também
                if (kmPorPlaca[placa] === undefined) {
                    kmPorPlaca[placa] = 0;
                }
                kmPorPlaca[placa] += km;
            });

            // 5. Converte em array e ordena do maior para o menor
            const ranking = Object.keys(kmPorPlaca)
                .map(placa => ({ placa, kmTotal: kmPorPlaca[placa] }))
                .sort((a, b) => b.kmTotal - a.kmTotal);

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
    // GRÁFICO ECHARTS MELHORADO
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
            
            // BARRA DE ROLAGEM INFERIOR (Deixa o gráfico perfeito mesmo com dezenas de caminhões)
            dataZoom: [
                {
                    type: 'slider',
                    show: true,
                    xAxisIndex: [0],
                    start: 0,
                    end: placas.length > 15 ? 40 : 100, // Mostra só os primeiros se tiver muitos
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
                    rotate: 45, // Deixa o nome inclinado para caber
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
                barMaxWidth: 45, // Garante que a barra não fique "gorda" demais
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

            // Exibe 0 KM se não tiver valor, ou 3 casas decimais
            let kmExibicao = item.kmTotal > 0 ? utils.formatNumber(item.kmTotal, 3) : "0,000";

            return `
            <tr style="border-bottom: 1px solid rgba(51, 65, 85, 0.4); transition: background 0.2s;" onmouseover="this.style.background='rgba(51, 65, 85, 0.3)'" onmouseout="this.style.background='transparent'">
                <td style="text-align: center; ${posStyle}">${icon}${index + 1}º</td>
                <td style="font-weight: 600; color: #38bdf8; font-size: 1.05rem;">${item.placa}</td>
                <td style="text-align: right; font-weight: 600; padding-right: 20px;">
                    <span style="background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 6px 12px; border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.2); display: inline-block; min-width: 100px; text-align: center;">
                        ${kmExibicao} KM
                    </span>
                </td>
            </tr>
            `;
        }).join('');
    }

    // ==========================================
    // FUNÇÃO OBRIGATÓRIA PARA O APP.JS NÃO DAR ERRO
    // ==========================================
    function getAllCavalos() {
        return cavalos;
    }

    // Exporta o que o sistema precisa
    return { 
        load: loadRanking,
        getAll: getAllCavalos
    };
})();