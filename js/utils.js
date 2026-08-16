// Utility functions for Motorista Padrão System
window.utils = {
    formatDate(date) {
        if (!date) return '-';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('pt-BR');
    },
    
    formatDateTime(date) {
        if (!date) return '-';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '-';
        const dataStr = d.toLocaleDateString('pt-BR');
        const horaStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return `${dataStr} às ${horaStr}`;
    },
    
    // CORREÇÃO: Usando toLocaleString para colocar pontos na casa de milhar automaticamente
    formatNumber(num, decimals = 2) {
        if (num === undefined || num === null) {
            return Number(0).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        }
        return parseFloat(num).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    },
    
    formatCPF(cpf) {
        cpf = cpf.replace(/\D/g, '');
        if (cpf.length === 11) {
            return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        }
        return cpf;
    },
    
    showAlert(message, type = 'success') {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <span>${message}</span>
        `;
        
        const container = document.querySelector('.content-area');
        if (container) {
            container.insertBefore(alertDiv, container.firstChild);
        }
        
        setTimeout(() => {
            alertDiv.remove();
        }, 3000);
    },
    
    getMonthYear() {
        const now = new Date();
        return `${now.getMonth() + 1}-${now.getFullYear()}`;
    },
    
    shouldResetScore(lastReset) {
        if (!lastReset) return true;
        const lastResetDate = new Date(lastReset);
        const now = new Date();
        return lastResetDate.getMonth() !== now.getMonth() ||
               lastResetDate.getFullYear() !== now.getFullYear();
    },
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};