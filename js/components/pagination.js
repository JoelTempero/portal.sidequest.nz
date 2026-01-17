// Pagination and Infinite Scroll Component

/**
 * Pagination state manager
 */
export class Paginator {
    constructor(options = {}) {
        this.itemsPerPage = options.itemsPerPage || 20;
        this.currentPage = 1;
        this.totalItems = 0;
        this.onPageChange = options.onPageChange || (() => {});
    }

    /**
     * Get paginated slice of items
     * @param {Array} items - All items
     * @returns {Array} - Items for current page
     */
    getPage(items) {
        this.totalItems = items.length;
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        return items.slice(start, end);
    }

    /**
     * Get total pages
     */
    get totalPages() {
        return Math.ceil(this.totalItems / this.itemsPerPage);
    }

    /**
     * Go to specific page
     */
    goToPage(page) {
        const newPage = Math.max(1, Math.min(page, this.totalPages));
        if (newPage !== this.currentPage) {
            this.currentPage = newPage;
            this.onPageChange(newPage);
        }
    }

    /**
     * Go to next page
     */
    nextPage() {
        this.goToPage(this.currentPage + 1);
    }

    /**
     * Go to previous page
     */
    prevPage() {
        this.goToPage(this.currentPage - 1);
    }

    /**
     * Reset to first page
     */
    reset() {
        this.currentPage = 1;
    }

    /**
     * Render pagination controls
     * @param {string} containerId - ID of container element
     */
    renderControls(containerId) {
        const container = document.getElementById(containerId);
        if (!container || this.totalPages <= 1) {
            if (container) container.innerHTML = '';
            return;
        }

        const startItem = (this.currentPage - 1) * this.itemsPerPage + 1;
        const endItem = Math.min(this.currentPage * this.itemsPerPage, this.totalItems);

        container.innerHTML = 
            '<div class="pagination" role="navigation" aria-label="Pagination">' +
            '<span class="pagination-info">Showing ' + startItem + '-' + endItem + ' of ' + this.totalItems + '</span>' +
            '<div class="pagination-controls">' +
            '<button class="btn btn-ghost btn-sm" onclick="window._paginator?.prevPage()" ' + (this.currentPage === 1 ? 'disabled' : '') + ' aria-label="Previous page">' +
            '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>' +
            '</button>' +
            '<span class="pagination-pages" aria-current="page">Page ' + this.currentPage + ' of ' + this.totalPages + '</span>' +
            '<button class="btn btn-ghost btn-sm" onclick="window._paginator?.nextPage()" ' + (this.currentPage === this.totalPages ? 'disabled' : '') + ' aria-label="Next page">' +
            '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>' +
            '</button>' +
            '</div></div>';
    }
}

/**
 * Infinite scroll handler
 */
export class InfiniteScroll {
    constructor(options = {}) {
        this.container = options.container;
        this.loadMore = options.loadMore || (() => {});
        this.threshold = options.threshold || 200;
        this.loading = false;
        this.hasMore = true;
        this.observer = null;
    }

    init() {
        if (!this.container) return;

        this.sentinel = document.createElement('div');
        this.sentinel.className = 'infinite-scroll-sentinel';
        this.sentinel.setAttribute('aria-hidden', 'true');
        this.container.appendChild(this.sentinel);

        this.observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !this.loading && this.hasMore) {
                    this.triggerLoad();
                }
            },
            { rootMargin: this.threshold + 'px' }
        );

        this.observer.observe(this.sentinel);
    }

    async triggerLoad() {
        if (this.loading || !this.hasMore) return;

        this.loading = true;
        this.showLoader();

        try {
            const moreItems = await this.loadMore();
            if (!moreItems || moreItems.length === 0) {
                this.hasMore = false;
            }
        } catch (e) {
            console.error('[InfiniteScroll] Load error:', e);
        } finally {
            this.loading = false;
            this.hideLoader();
        }
    }

    showLoader() {
        if (!this.loader) {
            this.loader = document.createElement('div');
            this.loader.className = 'infinite-scroll-loader';
            this.loader.innerHTML = '<div class="spinner"></div><span>Loading more...</span>';
            this.loader.setAttribute('aria-live', 'polite');
        }
        this.sentinel.before(this.loader);
    }

    hideLoader() {
        if (this.loader) this.loader.remove();
    }

    reset() {
        this.loading = false;
        this.hasMore = true;
        this.hideLoader();
    }

    destroy() {
        if (this.observer) this.observer.disconnect();
        if (this.sentinel) this.sentinel.remove();
        this.hideLoader();
    }
}
