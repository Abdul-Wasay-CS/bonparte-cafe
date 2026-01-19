// Updated DataAPI class with backend support
class DataAPI {
    constructor() {
        this.basePath = '/api/data/';
        this.cache = new Map();
        this.cacheTime = 30 * 1000; // 30 seconds cache
    }

    async fetchData(filename) {
        const cacheKey = filename;
        const cached = this.cache.get(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp < this.cacheTime)) {
            console.log(`Using cached data for ${filename}`);
            return cached.data;
        }

        try {
            const response = await fetch(`${this.basePath}${filename}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(`API error: ${result.error}`);
            }
            
            const data = result.data;
            
            // Cache the data
            this.cache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
            });
            
            console.log(`Loaded ${filename} from backend`);
            return data;
        } catch (error) {
            console.error(`Error fetching ${filename}:`, error);
            
            // Fallback: Try to load from localStorage (for offline mode)
            const fallbackData = this.getFromLocalStorage(filename);
            if (fallbackData) {
                console.log(`Using localStorage fallback for ${filename}`);
                return fallbackData;
            }
            
            this.showToast('Failed to load data. Please check your server connection.', 'error');
            return null;
        }
    }

    async saveData(filename, data) {
        try {
            const response = await fetch(`${this.basePath}${filename}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(`API error: ${result.error}`);
            }
            
            // Clear cache for this file
            this.cache.delete(filename);
            
            // Also save to localStorage as backup
            this.saveToLocalStorage(filename, data);
            
            console.log(`Successfully saved ${filename}`);
            return result;
        } catch (error) {
            console.error(`Error saving ${filename}:`, error);
            
            // Fallback: Save to localStorage
            this.saveToLocalStorage(filename, data);
            this.showToast('Saved to localStorage (server offline)', 'warning');
            
            return {
                success: false,
                error: error.message,
                savedLocally: true
            };
        }
    }

    async updateItem(filename, id, updateData) {
        try {
            const response = await fetch(`${this.basePath}${filename}/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData)
            });
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(`API error: ${result.error}`);
            }
            
            // Clear cache for this file
            this.cache.delete(filename);
            
            console.log(`Successfully updated item ${id} in ${filename}`);
            return result;
        } catch (error) {
            console.error(`Error updating item in ${filename}:`, error);
            throw error;
        }
    }

    async deleteItem(filename, id) {
        try {
            const response = await fetch(`${this.basePath}${filename}/${id}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(`API error: ${result.error}`);
            }
            
            // Clear cache for this file
            this.cache.delete(filename);
            
            console.log(`Successfully deleted item ${id} from ${filename}`);
            return result;
        } catch (error) {
            console.error(`Error deleting item from ${filename}:`, error);
            throw error;
        }
    }

    // LocalStorage fallback methods
    saveToLocalStorage(filename, data) {
        try {
            localStorage.setItem(`cafe_${filename}`, JSON.stringify(data));
            localStorage.setItem(`cafe_${filename}_timestamp`, Date.now().toString());
        } catch (error) {
            console.error(`Error saving to localStorage:`, error);
        }
    }

    getFromLocalStorage(filename) {
        try {
            const data = localStorage.getItem(`cafe_${filename}`);
            const timestamp = localStorage.getItem(`cafe_${filename}_timestamp`);
            
            if (data && timestamp) {
                // Check if data is less than 1 hour old
                if (Date.now() - parseInt(timestamp) < 60 * 60 * 1000) {
                    return JSON.parse(data);
                }
            }
        } catch (error) {
            console.error(`Error reading from localStorage:`, error);
        }
        return null;
    }

    clearCache() {
        this.cache.clear();
        console.log('Data cache cleared');
    }

    // Health check
    async checkHealth() {
        try {
            const response = await fetch('/api/health');
            const result = await response.json();
            return result.status === 'OK';
        } catch (error) {
            console.error('Health check failed:', error);
            return false;
        }
    }

    // Helper method for showing toast messages
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        
        const toastMessage = toast.querySelector('.toast-message');
        const toastIcon = toast.querySelector('i');
        
        toastMessage.textContent = message;
        
        // Set icon based on type
        if (type === 'error') {
            toastIcon.className = 'fas fa-exclamation-circle';
            toast.style.backgroundColor = 'var(--error-red)';
        } else if (type === 'warning') {
            toastIcon.className = 'fas fa-exclamation-triangle';
            toast.style.backgroundColor = '#ff9800';
        } else {
            toastIcon.className = 'fas fa-check-circle';
            toast.style.backgroundColor = 'var(--success-green)';
        }
        
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}


// UI Renderer - Handles dynamic content rendering
class UIRenderer {
    constructor() {
        this.api = new DataAPI();
        this.searchTerm = '';
        this.currentCategory = 'all';
    }

    // Menu rendering
    async renderMenu() {
        const menuGrid = document.getElementById('menuGrid');
        const menuLoading = document.getElementById('menuLoading');
        const menuCategories = document.getElementById('menuCategories');
        
        menuGrid.innerHTML = '';
        menuLoading.style.display = 'flex';
        
        try {
            const menuData = await this.api.getMenuData();
            if (!menuData) return;
            
            // Render category filters
            this.renderCategories(menuData.categories, menuCategories);
            
            // Get search term
            const searchInput = document.getElementById('searchInput');
            this.searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
            
            // Filter items based on search and category
            let filteredItems = menuData.items;
            
            if (this.searchTerm) {
                filteredItems = filteredItems.filter(item => 
                    item.name.toLowerCase().includes(this.searchTerm) ||
                    item.description.toLowerCase().includes(this.searchTerm) ||
                    item.category.toLowerCase().includes(this.searchTerm)
                );
                this.showSearchResults(filteredItems.length);
            }
            
            if (this.currentCategory !== 'all') {
                filteredItems = filteredItems.filter(item => 
                    item.category === this.currentCategory
                );
            }
            
            // Sort items
            const sortSelect = document.getElementById('sortMenu');
            const sortValue = sortSelect ? sortSelect.value : 'category';
            this.sortMenuItems(filteredItems, sortValue);
            
            // Render items
            if (filteredItems.length === 0) {
                menuGrid.innerHTML = `
                    <div class="no-results">
                        <i class="fas fa-search"></i>
                        <h3>No menu items found</h3>
                        <p>Try a different search term or category</p>
                    </div>
                `;
            } else {
                filteredItems.forEach(item => {
                    const menuItem = this.createMenuItem(item);
                    menuGrid.appendChild(menuItem);
                });
            }
            
            // Add animation
            this.animateElements(menuGrid.children);
            
        } catch (error) {
            console.error('Error rendering menu:', error);
            menuGrid.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Failed to load menu</h3>
                    <p>Please try again later</p>
                </div>
            `;
        } finally {
            menuLoading.style.display = 'none';
        }
    }

    renderCategories(categories, container) {
        if (!container) return;
        
        container.innerHTML = `
            <button class="category-btn active" data-category="all">All</button>
            ${categories.map(category => `
                <button class="category-btn" data-category="${category}">${category}</button>
            `).join('')}
        `;
        
        // Add event listeners to category buttons
        container.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentCategory = btn.dataset.category;
                this.renderMenu();
            });
        });
    }

    createMenuItem(item) {
        const div = document.createElement('div');
        div.className = 'menu-item';
        div.dataset.category = item.category;
        
        div.innerHTML = `
            <div class="menu-img" style="background-image: url('${item.image}')"></div>
            <div class="menu-content">
                <h3>${item.name}</h3>
                <div class="item-price">$${item.price.toFixed(2)}</div>
                <p class="item-description">${item.description}</p>
                <span class="item-category">${item.category}</span>
            </div>
        `;
        
        return div;
    }

    sortMenuItems(items, sortBy) {
        switch(sortBy) {
            case 'price-low':
                items.sort((a, b) => a.price - b.price);
                break;
            case 'price-high':
                items.sort((a, b) => b.price - a.price);
                break;
            case 'name':
                items.sort((a, b) => a.name.localeCompare(b.name));
                break;
            default:
                items.sort((a, b) => a.category.localeCompare(b.category));
        }
    }

    // Specials rendering
    async renderSpecials() {
        const specialsGrid = document.getElementById('specialsGrid');
        const specialsLoading = document.getElementById('specialsLoading');
        
        specialsGrid.innerHTML = '';
        specialsLoading.style.display = 'flex';
        
        try {
            const specialsData = await this.api.getSpecialsData();
            if (!specialsData) return;
            
            const today = new Date().toLocaleString('en-US', { weekday: 'long' });
            
            specialsData.specials.forEach(special => {
                const specialCard = this.createSpecialCard(special, today);
                specialsGrid.appendChild(specialCard);
            });
            
            this.animateElements(specialsGrid.children);
            
        } catch (error) {
            console.error('Error rendering specials:', error);
            specialsGrid.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Failed to load specials</h3>
                    <p>Please try again later</p>
                </div>
            `;
        } finally {
            specialsLoading.style.display = 'none';
        }
    }

    createSpecialCard(special, today) {
        const div = document.createElement('div');
        div.className = `special-card ${special.day === today ? 'today' : ''}`;
        
        div.innerHTML = `
            ${special.day === today ? '<div class="today-badge">TODAY</div>' : ''}
            <div class="special-day">${special.day}</div>
            <h3>${special.name}</h3>
            <p class="special-items">${special.items}</p>
            <p class="special-description">${special.description}</p>
            <div class="special-pricing">
                <span class="special-price">$${special.price.toFixed(2)}</span>
                <span class="special-discount">${special.discount} OFF</span>
            </div>
        `;
        
        return div;
    }

    // Events rendering
    async renderEvents() {
        const eventsGrid = document.getElementById('eventsGrid');
        const eventsLoading = document.getElementById('eventsLoading');
        
        eventsGrid.innerHTML = '';
        eventsLoading.style.display = 'flex';
        
        try {
            const eventsData = await this.api.getEventsData();
            if (!eventsData) return;
            
            // Filter by search term
            let filteredEvents = eventsData.events;
            if (this.searchTerm) {
                filteredEvents = filteredEvents.filter(event => 
                    event.name.toLowerCase().includes(this.searchTerm) ||
                    event.description.toLowerCase().includes(this.searchTerm) ||
                    event.tag.toLowerCase().includes(this.searchTerm)
                );
            }
            
            if (filteredEvents.length === 0) {
                eventsGrid.innerHTML = `
                    <div class="no-results">
                        <i class="fas fa-calendar-times"></i>
                        <h3>No events found</h3>
                        <p>Try a different search term</p>
                    </div>
                `;
            } else {
                filteredEvents.forEach(event => {
                    const eventCard = this.createEventCard(event);
                    eventsGrid.appendChild(eventCard);
                });
            }
            
            this.animateElements(eventsGrid.children);
            
        } catch (error) {
            console.error('Error rendering events:', error);
            eventsGrid.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Failed to load events</h3>
                    <p>Please try again later</p>
                </div>
            `;
        } finally {
            eventsLoading.style.display = 'none';
        }
    }

    createEventCard(event) {
        const div = document.createElement('div');
        div.className = 'event-card';
        
        div.innerHTML = `
            <div class="event-img" style="background-image: url('${event.image}')"></div>
            <div class="event-content">
                <div class="event-date">
                    <i class="far fa-calendar-alt"></i>
                    ${event.date}
                </div>
                <h3>${event.name}</h3>
                <p>${event.description}</p>
                <span class="event-tag">${event.tag}</span>
            </div>
        `;
        
        return div;
    }

    // Contact rendering
    async renderContact() {
        const contactGrid = document.getElementById('contactGrid');
        const socialLinks = document.getElementById('socialLinks');
        const currentYear = document.getElementById('currentYear');
        const lastUpdated = document.getElementById('lastUpdated');
        
        if (!contactGrid) return;
        
        try {
            const contactData = await this.api.getContactData();
            if (!contactData) return;
            
            // Render contact info
            contactGrid.innerHTML = `
                <div class="contact-info">
                    <div class="contact-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <div>
                            <h3>Address</h3>
                            <p>${contactData.address.replace(/\n/g, '<br>')}</p>
                        </div>
                    </div>
                    
                    <div class="contact-item">
                        <i class="fas fa-phone"></i>
                        <div>
                            <h3>Phone</h3>
                            <p>${contactData.phone}</p>
                        </div>
                    </div>
                    
                    <div class="contact-item">
                        <i class="fas fa-clock"></i>
                        <div>
                            <h3>Working Hours</h3>
                            <p>${contactData.workingHours.weekdays}</p>
                            <p>${contactData.workingHours.weekends}</p>
                        </div>
                    </div>
                    
                    <div class="contact-item">
                        <i class="fas fa-envelope"></i>
                        <div>
                            <h3>Email</h3>
                            <p>${contactData.email}</p>
                        </div>
                    </div>
                </div>
                
                <div class="map-placeholder">
                    <div class="map-overlay">
                        <h3>Find Our Location</h3>
                        <p>Easy parking available • Wheelchair accessible</p>
                    </div>
                </div>
            `;
            
            // Render social links
            if (socialLinks) {
                socialLinks.innerHTML = `
                    <a href="${contactData.socialMedia.facebook}" target="_blank"><i class="fab fa-facebook-f"></i></a>
                    <a href="${contactData.socialMedia.instagram}" target="_blank"><i class="fab fa-instagram"></i></a>
                    <a href="${contactData.socialMedia.twitter}" target="_blank"><i class="fab fa-twitter"></i></a>
                    <a href="${contactData.socialMedia.tripadvisor}" target="_blank"><i class="fab fa-tripadvisor"></i></a>
                `;
            }
            
            // Set current year
            if (currentYear) {
                currentYear.textContent = new Date().getFullYear();
            }
            
            // Set last updated time
            if (lastUpdated) {
                lastUpdated.textContent = new Date().toLocaleString();
            }
            
            this.animateElements(contactGrid.querySelectorAll('.contact-item'));
            
        } catch (error) {
            console.error('Error rendering contact:', error);
        }
    }

    // Helper methods
    showSearchResults(count) {
        const header = document.getElementById('searchResultsHeader');
        if (header) {
            header.style.display = 'flex';
            header.querySelector('h3').textContent = `Search Results (${count} items found)`;
        }
    }

    clearSearch() {
        this.searchTerm = '';
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = '';
        
        const header = document.getElementById('searchResultsHeader');
        if (header) header.style.display = 'none';
        
        this.renderMenu();
        this.renderEvents();
    }

    animateElements(elements) {
        Array.from(elements).forEach((element, index) => {
            element.style.animationDelay = `${index * 0.1}s`;
            element.classList.add('animated');
        });
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMessage = toast.querySelector('.toast-message');
        
        toastMessage.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Initialize search functionality
    initSearch() {
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        const clearSearchBtn = document.getElementById('clearSearch');
        const sortSelect = document.getElementById('sortMenu');
        
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.searchTerm = searchInput.value.toLowerCase();
                this.renderMenu();
                this.renderEvents();
            });
        }
        
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.searchTerm = searchInput.value.toLowerCase();
                    this.renderMenu();
                    this.renderEvents();
                }
            });
        }
        
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                this.clearSearch();
            });
        }
        
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                this.renderMenu();
            });
        }
    }

    // Refresh all data
    async refreshData() {
        this.api.clearCache();
        await Promise.all([
            this.renderMenu(),
            this.renderSpecials(),
            this.renderEvents(),
            this.renderContact()
        ]);
        this.showToast('Data refreshed successfully');
    }
}

// Main Application
class CafeApp {
    constructor() {
        this.ui = new UIRenderer();
        this.init();
    }

    async init() {
        // Initialize UI components
        this.initNavigation();
        this.initBackgroundAnimation();
        
        // Render all sections
        await Promise.all([
            this.ui.renderMenu(),
            this.ui.renderSpecials(),
            this.ui.renderEvents(),
            this.ui.renderContact()
        ]);
        
        // Initialize search
        this.ui.initSearch();
        
        // Set up periodic refresh (every 30 seconds)
        setInterval(() => {
            this.ui.refreshData();
        }, 30000);
        
        console.log('The Bonparte Cafe website initialized successfully!');
    }

    initNavigation() {
        const navbar = document.querySelector('.navbar');
        const navLinks = document.querySelectorAll('.nav-link');
        const hamburger = document.querySelector('.hamburger');
        const navMenu = document.querySelector('.nav-menu');

        // Navbar scroll effect
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
            
            // Update active nav link
            let current = '';
            const sections = document.querySelectorAll('section');
            
            sections.forEach(section => {
                const sectionTop = section.offsetTop;
                const sectionHeight = section.clientHeight;
                
                if (window.scrollY >= (sectionTop - 200)) {
                    current = section.getAttribute('id');
                }
            });
            
            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${current}`) {
                    link.classList.add('active');
                }
            });
        });

        // Smooth scrolling
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                if (link.getAttribute('href').startsWith('#')) {
                    e.preventDefault();
                    
                    const targetId = link.getAttribute('href');
                    const targetSection = document.querySelector(targetId);
                    
                    if (targetSection) {
                        window.scrollTo({
                            top: targetSection.offsetTop - 80,
                            behavior: 'smooth'
                        });
                        
                        // Close mobile menu
                        hamburger.classList.remove('active');
                        navMenu.classList.remove('active');
                    }
                }
            });
        });

        // Mobile menu toggle
        if (hamburger) {
            hamburger.addEventListener('click', () => {
                hamburger.classList.toggle('active');
                navMenu.classList.toggle('active');
            });
        }

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (hamburger && !hamburger.contains(e.target) && navMenu && !navMenu.contains(e.target)) {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            }
        });
    }

    initBackgroundAnimation() {
        let hue = 0;
        function updateBackgroundColor() {
            hue = (hue + 0.1) % 360;
            const color1 = `hsl(${hue}, 70%, 5%)`;
            const color2 = `hsl(${(hue + 40) % 360}, 70%, 5%)`;
            
            document.body.style.background = `linear-gradient(135deg, ${color1}, ${color2})`;
            requestAnimationFrame(updateBackgroundColor);
        }
        updateBackgroundColor();
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Add loading animation
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.5s ease';
    
    setTimeout(() => {
        document.body.style.opacity = '1';
        new CafeApp();
    }, 100);
});