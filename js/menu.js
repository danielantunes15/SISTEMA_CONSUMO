// Arquivo: js/menu.js
class AppSidebar extends HTMLElement {
    connectedCallback() {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        
        this.innerHTML = `
        <aside class="sidebar">
            <div class="logo-area">
                <i class="fas fa-tachometer-alt" style="color: #3b82f6; font-size: 24px; margin-right: 10px;"></i>
                <span style="color: #f8fafc; font-weight: 700; font-size: 1.2rem;">Motorista Padrão</span>
            </div>
            <nav class="nav-menu">
                <a href="index.html" class="nav-item ${currentPage === 'index.html' ? 'active' : ''}">
                    <i class="fas fa-chart-line"></i><span>Dashboard</span>
                </a>
                <a href="cavalos.html" class="nav-item ${currentPage === 'cavalos.html' ? 'active' : ''}">
                    <i class="fas fa-truck-moving"></i><span>Cavalos</span>
                </a>
                <a href="motoristas.html" class="nav-item ${currentPage === 'motoristas.html' ? 'active' : ''}">
                    <i class="fas fa-users"></i><span>Motoristas</span>
                </a>
                <a href="ocorrencias.html" class="nav-item ${currentPage === 'ocorrencias.html' ? 'active' : ''}">
                    <i class="fas fa-exclamation-triangle"></i><span>Ocorrências</span>
                </a>
                <a href="importar.html" class="nav-item ${currentPage === 'importar.html' ? 'active' : ''}">
                    <i class="fas fa-upload"></i><span>Importar Dados</span>
                </a>
                <a href="historico.html" class="nav-item ${currentPage === 'historico.html' ? 'active' : ''}">
                    <i class="fas fa-history"></i><span>Histórico</span>
                </a>
                <a href="ranking.html" class="nav-item ${currentPage === 'ranking.html' ? 'active' : ''}">
                    <i class="fas fa-trophy"></i><span>Hall da Fama</span>
                </a>
                <a href="ranking-geral.html" class="nav-item ${currentPage === 'ranking-geral.html' ? 'active' : ''}">
                    <i class="fas fa-globe"></i><span>Ranking Geral</span>
                </a>
                <a href="auditoria.html" class="nav-item ${currentPage === 'auditoria.html' ? 'active' : ''}">
                    <i class="fas fa-user-tie"></i><span>Visão Gerencial</span>
                </a>
                <a href="configuracoes.html" class="nav-item ${currentPage === 'configuracoes.html' ? 'active' : ''}">
                    <i class="fas fa-cog"></i><span>Configurações</span>
                </a>
            </nav>
            <div class="sidebar-footer">Sistema de Frotas v2.0 (Online)</div>
        </aside>
        `;
    }
}

class AppTopbar extends HTMLElement {
    connectedCallback() {
        const title = this.getAttribute('title') || 'Dashboard';
        this.innerHTML = `
        <div class="top-bar">
            <div class="header-content">
                <div class="header-left">
                    <i class="fas fa-bars menu-toggle"></i>
                    <h1>${title}</h1>
                </div>
                <div class="user-info">
                    <div class="status-indicator"></div>
                    <span>CCOL - MUCURI - SERRANA</span>
                    <i class="fas fa-user-circle"></i>
                </div>
            </div>
        </div>
        `;
    }
}

customElements.define('app-sidebar', AppSidebar);
customElements.define('app-topbar', AppTopbar);