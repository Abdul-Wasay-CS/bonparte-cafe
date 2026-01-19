// Complete AdminPanel class with backend API integration
class AdminPanel {
    constructor() {
        this.api = new DataAPI();
        this.currentData = {
            menu: null,
            specials: null,
            events: null,
            contact: null
        };
        this.editingItem = null;
        this.editingSpecial = null;
        this.editingEvent = null;
        this.init();
    }

    async init() {
        console.log('Initializing Admin Panel...');
        
        // Check server health
        const isHealthy = await this.api.checkHealth();
        if (!isHealthy) {
            this.showToast('⚠️ Server connection failed. Working in offline mode.', 'warning');
        }
        
        // Initialize navigation
        this.initNavigation();
        
        // Load all data
        await this.loadAllData();
        
        // Set up form handlers
        this.setupFormHandlers();
        
        // Load initial JSON file
        await this.loadSelectedJSON();
        
        console.log('Admin panel initialized successfully');
        this.showToast('Admin panel ready!', 'success');
    }

    initNavigation() {
        const navButtons = document.querySelectorAll('.admin-nav-btn');
        const sections = document.querySelectorAll('.admin-section');
        
        navButtons.forEach(button => {
            button.addEventListener('click', () => {
                const sectionId = button.dataset.section;
                
                // Update active button
                navButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // Show selected section
                sections.forEach(section => section.classList.remove('active'));
                document.getElementById(`${sectionId}Section`).classList.add('active');
                
                // Refresh data for the section
                this.refreshSectionData(sectionId);
            });
        });
    }

    async loadAllData() {
        try {
            console.log('Loading all data from server...');
            
            // Load all data at once
            const response = await fetch('/api/data');
            const result = await response.json();
            
            if (result.success && result.data) {
                this.currentData = result.data;
                console.log('Data loaded successfully:', this.currentData);
            } else {
                throw new Error('Failed to load data from server');
            }
            
            this.refreshSectionData('menu');
            
        } catch (error) {
            console.error('Error loading data:', error);
            
            // Try to load each file individually
            await this.loadDataIndividually();
        }
    }

    async loadDataIndividually() {
        const files = [
            { key: 'menu', filename: 'menu.json' },
            { key: 'specials', filename: 'specials.json' },
            { key: 'events', filename: 'events.json' },
            { key: 'contact', filename: 'contact.json' }
        ];
        
        for (const file of files) {
            try {
                const data = await this.api.fetchData(file.filename);
                if (data) {
                    this.currentData[file.key] = data;
                }
            } catch (error) {
                console.error(`Error loading ${file.filename}:`, error);
            }
        }
        
        this.refreshSectionData('menu');
    }

    refreshSectionData(section) {
        switch(section) {
            case 'menu':
                this.renderMenuTable();
                break;
            case 'specials':
                this.renderSpecialsTable();
                break;
            case 'events':
                this.renderEventsTable();
                break;
            case 'contact':
                this.loadContactForm();
                break;
        }
    }

    setupFormHandlers() {
        // Menu form
        const menuForm = document.getElementById('menuForm');
        if (menuForm) {
            menuForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveMenuItem();
            });
        }

        // Specials form
        const specialForm = document.getElementById('specialForm');
        if (specialForm) {
            specialForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveSpecial();
            });
        }

        // Events form
        const eventForm = document.getElementById('eventForm');
        if (eventForm) {
            eventForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveEvent();
            });
        }

        // Contact form
        const contactForm = document.getElementById('contactForm');
        if (contactForm) {
            contactForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveContact();
            });
        }
    }

    // ==================== MENU MANAGEMENT ====================
    renderMenuTable() {
        const container = document.getElementById('menuTableContainer');
        if (!container || !this.currentData.menu) return;

        const items = this.currentData.menu.items;
        
        let html = `
            <div class="table-header">
                <h4>Menu Items (${items.length} total)</h4>
                <div class="table-actions">
                    <button class="btn-refresh" onclick="admin.refreshMenuData()">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>Description</th>
                        <th>Image</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        items.forEach(item => {
            html += `
                <tr>
                    <td>${item.id}</td>
                    <td><strong>${item.name}</strong></td>
                    <td><span class="item-category">${item.category}</span></td>
                    <td>$${item.price.toFixed(2)}</td>
                    <td>${item.description.substring(0, 50)}...</td>
                    <td>${item.image.split('/').pop()}</td>
                    <td class="action-buttons">
                        <button class="btn-edit" onclick="admin.editMenuItem(${item.id})">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn-delete" onclick="admin.deleteMenuItem(${item.id})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    }

    async saveMenuItem() {
        const form = document.getElementById('menuForm');
        if (!form) return;

        const itemData = {
            id: this.editingItem ? this.editingItem.id : this.getNextId(this.currentData.menu.items),
            name: document.getElementById('itemName').value.trim(),
            category: document.getElementById('itemCategory').value,
            price: parseFloat(document.getElementById('itemPrice').value),
            description: document.getElementById('itemDescription').value.trim(),
            image: document.getElementById('itemImage').value.trim()
        };

        // Validation
        if (!itemData.name || !itemData.category || !itemData.price || !itemData.description || !itemData.image) {
            this.showToast('Please fill all required fields', 'error');
            return;
        }

        if (itemData.price <= 0) {
            this.showToast('Price must be greater than 0', 'error');
            return;
        }

        try {
            if (this.editingItem) {
                // Update existing item
                const index = this.currentData.menu.items.findIndex(item => item.id === this.editingItem.id);
                if (index !== -1) {
                    this.currentData.menu.items[index] = itemData;
                }
            } else {
                // Add new item
                this.currentData.menu.items.push(itemData);
            }

            // Save to server
            const result = await this.api.saveData('menu.json', this.currentData.menu);
            
            if (result.success) {
                this.showToast(this.editingItem ? 'Menu item updated!' : 'Menu item added!');
                this.resetMenuForm();
                this.renderMenuTable();
                
                // Refresh main website data
                this.refreshMainWebsite();
            } else {
                throw new Error(result.error || 'Failed to save menu item');
            }
            
        } catch (error) {
            console.error('Error saving menu item:', error);
            this.showToast(`Failed to save menu item: ${error.message}`, 'error');
        }
    }

    editMenuItem(itemId) {
        const item = this.currentData.menu.items.find(item => item.id === itemId);
        if (!item) return;

        this.editingItem = item;
        
        document.getElementById('itemName').value = item.name;
        document.getElementById('itemCategory').value = item.category;
        document.getElementById('itemPrice').value = item.price;
        document.getElementById('itemDescription').value = item.description;
        document.getElementById('itemImage').value = item.image;
        
        const submitBtn = document.querySelector('#menuForm .btn-save');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Item';
            submitBtn.style.backgroundColor = '#2196F3';
        }
        
        // Scroll to form
        document.getElementById('menuForm').scrollIntoView({ behavior: 'smooth' });
    }

    async deleteMenuItem(itemId) {
        if (!confirm('Are you sure you want to delete this menu item?')) return;

        try {
            // Delete from server
            const result = await this.api.deleteItem('menu.json', itemId);
            
            if (result.success) {
                // Update local data
                this.currentData.menu.items = this.currentData.menu.items.filter(item => item.id !== itemId);
                
                this.showToast('Menu item deleted!');
                this.renderMenuTable();
                
                // Refresh main website data
                this.refreshMainWebsite();
            } else {
                throw new Error(result.error || 'Failed to delete menu item');
            }
            
        } catch (error) {
            console.error('Error deleting menu item:', error);
            this.showToast(`Failed to delete menu item: ${error.message}`, 'error');
        }
    }

    // ==================== SPECIALS MANAGEMENT ====================
    renderSpecialsTable() {
        const container = document.getElementById('specialsTableContainer');
        if (!container || !this.currentData.specials) return;

        const specials = this.currentData.specials.specials;
        
        let html = `
            <div class="table-header">
                <h4>Daily Specials (${specials.length} total)</h4>
                <div class="table-actions">
                    <button class="btn-refresh" onclick="admin.refreshSpecialsData()">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Day</th>
                        <th>Combo Name</th>
                        <th>Items</th>
                        <th>Price</th>
                        <th>Discount</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        specials.forEach(special => {
            html += `
                <tr>
                    <td><strong>${special.day}</strong></td>
                    <td>${special.name}</td>
                    <td>${special.items}</td>
                    <td>$${special.price.toFixed(2)}</td>
                    <td><span class="special-discount">${special.discount}</span></td>
                    <td class="action-buttons">
                        <button class="btn-edit" onclick="admin.editSpecial(${special.id})">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn-delete" onclick="admin.deleteSpecial(${special.id})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    }

    async saveSpecial() {
        const form = document.getElementById('specialForm');
        if (!form) return;

        const specialData = {
            id: this.editingSpecial ? this.editingSpecial.id : this.getNextId(this.currentData.specials.specials),
            day: document.getElementById('specialDay').value,
            name: document.getElementById('specialName').value.trim(),
            items: document.getElementById('specialItems').value.trim(),
            price: parseFloat(document.getElementById('specialPrice').value),
            discount: document.getElementById('specialDiscount').value.trim(),
            description: document.getElementById('specialDescription').value.trim()
        };

        // Validation
        if (!specialData.day || !specialData.name || !specialData.items || !specialData.price || !specialData.discount) {
            this.showToast('Please fill all required fields', 'error');
            return;
        }

        if (specialData.price <= 0) {
            this.showToast('Price must be greater than 0', 'error');
            return;
        }

        try {
            if (this.editingSpecial) {
                // Update existing special
                const index = this.currentData.specials.specials.findIndex(s => s.id === this.editingSpecial.id);
                if (index !== -1) {
                    this.currentData.specials.specials[index] = specialData;
                }
            } else {
                // Add new special
                this.currentData.specials.specials.push(specialData);
            }

            // Save to server
            const result = await this.api.saveData('specials.json', this.currentData.specials);
            
            if (result.success) {
                this.showToast(this.editingSpecial ? 'Special updated!' : 'Special added!');
                this.resetSpecialForm();
                this.renderSpecialsTable();
                
                // Refresh main website data
                this.refreshMainWebsite();
            } else {
                throw new Error(result.error || 'Failed to save special');
            }
            
        } catch (error) {
            console.error('Error saving special:', error);
            this.showToast(`Failed to save special: ${error.message}`, 'error');
        }
    }

    editSpecial(specialId) {
        const special = this.currentData.specials.specials.find(s => s.id === specialId);
        if (!special) return;

        this.editingSpecial = special;
        
        document.getElementById('specialDay').value = special.day;
        document.getElementById('specialName').value = special.name;
        document.getElementById('specialItems').value = special.items;
        document.getElementById('specialPrice').value = special.price;
        document.getElementById('specialDiscount').value = special.discount;
        document.getElementById('specialDescription').value = special.description;
        
        const submitBtn = document.querySelector('#specialForm .btn-save');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Special';
            submitBtn.style.backgroundColor = '#2196F3';
        }
        
        document.getElementById('specialForm').scrollIntoView({ behavior: 'smooth' });
    }

    async deleteSpecial(specialId) {
        if (!confirm('Are you sure you want to delete this special?')) return;

        try {
            // Delete from server
            const result = await this.api.deleteItem('specials.json', specialId);
            
            if (result.success) {
                // Update local data
                this.currentData.specials.specials = this.currentData.specials.specials.filter(s => s.id !== specialId);
                
                this.showToast('Special deleted!');
                this.renderSpecialsTable();
                
                // Refresh main website data
                this.refreshMainWebsite();
            } else {
                throw new Error(result.error || 'Failed to delete special');
            }
            
        } catch (error) {
            console.error('Error deleting special:', error);
            this.showToast(`Failed to delete special: ${error.message}`, 'error');
        }
    }

    // ==================== EVENTS MANAGEMENT ====================
    renderEventsTable() {
        const container = document.getElementById('eventsTableContainer');
        if (!container || !this.currentData.events) return;

        const events = this.currentData.events.events;
        
        let html = `
            <div class="table-header">
                <h4>Events (${events.length} total)</h4>
                <div class="table-actions">
                    <button class="btn-refresh" onclick="admin.refreshEventsData()">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Date/Time</th>
                        <th>Description</th>
                        <th>Tag</th>
                        <th>Image</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        events.forEach(event => {
            html += `
                <tr>
                    <td><strong>${event.name}</strong></td>
                    <td>${event.date}</td>
                    <td>${event.description.substring(0, 50)}...</td>
                    <td><span class="event-tag">${event.tag}</span></td>
                    <td>${event.image.split('/').pop()}</td>
                    <td class="action-buttons">
                        <button class="btn-edit" onclick="admin.editEvent(${event.id})">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn-delete" onclick="admin.deleteEvent(${event.id})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    }

    async saveEvent() {
        const form = document.getElementById('eventForm');
        if (!form) return;

        const eventData = {
            id: this.editingEvent ? this.editingEvent.id : this.getNextId(this.currentData.events.events),
            name: document.getElementById('eventName').value.trim(),
            date: document.getElementById('eventDate').value.trim(),
            description: document.getElementById('eventDescription').value.trim(),
            image: document.getElementById('eventImage').value.trim(),
            tag: document.getElementById('eventTag').value.trim(),
            featured: document.getElementById('eventFeatured').checked
        };

        // Validation
        if (!eventData.name || !eventData.date || !eventData.description || !eventData.image || !eventData.tag) {
            this.showToast('Please fill all required fields', 'error');
            return;
        }

        try {
            if (this.editingEvent) {
                // Update existing event
                const index = this.currentData.events.events.findIndex(e => e.id === this.editingEvent.id);
                if (index !== -1) {
                    this.currentData.events.events[index] = eventData;
                }
            } else {
                // Add new event
                this.currentData.events.events.push(eventData);
            }

            // Save to server
            const result = await this.api.saveData('events.json', this.currentData.events);
            
            if (result.success) {
                this.showToast(this.editingEvent ? 'Event updated!' : 'Event added!');
                this.resetEventForm();
                this.renderEventsTable();
                
                // Refresh main website data
                this.refreshMainWebsite();
            } else {
                throw new Error(result.error || 'Failed to save event');
            }
            
        } catch (error) {
            console.error('Error saving event:', error);
            this.showToast(`Failed to save event: ${error.message}`, 'error');
        }
    }

    editEvent(eventId) {
        const event = this.currentData.events.events.find(e => e.id === eventId);
        if (!event) return;

        this.editingEvent = event;
        
        document.getElementById('eventName').value = event.name;
        document.getElementById('eventDate').value = event.date;
        document.getElementById('eventDescription').value = event.description;
        document.getElementById('eventImage').value = event.image;
        document.getElementById('eventTag').value = event.tag;
        document.getElementById('eventFeatured').checked = event.featured || false;
        
        const submitBtn = document.querySelector('#eventForm .btn-save');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Event';
            submitBtn.style.backgroundColor = '#2196F3';
        }
        
        document.getElementById('eventForm').scrollIntoView({ behavior: 'smooth' });
    }

    async deleteEvent(eventId) {
        if (!confirm('Are you sure you want to delete this event?')) return;

        try {
            // Delete from server
            const result = await this.api.deleteItem('events.json', eventId);
            
            if (result.success) {
                // Update local data
                this.currentData.events.events = this.currentData.events.events.filter(e => e.id !== eventId);
                
                this.showToast('Event deleted!');
                this.renderEventsTable();
                
                // Refresh main website data
                this.refreshMainWebsite();
            } else {
                throw new Error(result.error || 'Failed to delete event');
            }
            
        } catch (error) {
            console.error('Error deleting event:', error);
            this.showToast(`Failed to delete event: ${error.message}`, 'error');
        }
    }

    // ==================== CONTACT MANAGEMENT ====================
    loadContactForm() {
        if (!this.currentData.contact) return;

        const contact = this.currentData.contact;
        
        document.getElementById('contactAddress').value = contact.address;
        document.getElementById('contactPhone').value = contact.phone;
        document.getElementById('contactEmail').value = contact.email;
        document.getElementById('contactWeekdays').value = contact.workingHours.weekdays;
        document.getElementById('contactWeekends').value = contact.workingHours.weekends;
        
        document.getElementById('socialFacebook').value = contact.socialMedia.facebook;
        document.getElementById('socialInstagram').value = contact.socialMedia.instagram;
        document.getElementById('socialTwitter').value = contact.socialMedia.twitter;
        document.getElementById('socialTripadvisor').value = contact.socialMedia.tripadvisor;
    }

    async saveContact() {
        const contactData = {
            address: document.getElementById('contactAddress').value.trim(),
            phone: document.getElementById('contactPhone').value.trim(),
            email: document.getElementById('contactEmail').value.trim(),
            workingHours: {
                weekdays: document.getElementById('contactWeekdays').value.trim(),
                weekends: document.getElementById('contactWeekends').value.trim()
            },
            socialMedia: {
                facebook: document.getElementById('socialFacebook').value.trim(),
                instagram: document.getElementById('socialInstagram').value.trim(),
                twitter: document.getElementById('socialTwitter').value.trim(),
                tripadvisor: document.getElementById('socialTripadvisor').value.trim()
            }
        };

        // Validation
        if (!contactData.address || !contactData.phone || !contactData.email || 
            !contactData.workingHours.weekdays || !contactData.workingHours.weekends) {
            this.showToast('Please fill all required fields', 'error');
            return;
        }

        try {
            this.currentData.contact = contactData;
            const result = await this.api.saveData('contact.json', this.currentData.contact);
            
            if (result.success) {
                this.showToast('Contact information updated!');
                
                // Refresh main website data
                this.refreshMainWebsite();
            } else {
                throw new Error(result.error || 'Failed to save contact information');
            }
            
        } catch (error) {
            console.error('Error saving contact:', error);
            this.showToast(`Failed to save contact information: ${error.message}`, 'error');
        }
    }

    // ==================== JSON EDITOR ====================
    async loadSelectedJSON() {
        const fileSelect = document.getElementById('jsonFileSelect');
        const jsonEditor = document.getElementById('jsonEditor');
        const jsonStatus = document.getElementById('jsonStatus');
        
        if (!fileSelect || !jsonEditor) return;
        
        const filename = fileSelect.value;
        
        try {
            const data = await this.api.fetchData(filename);
            if (data) {
                jsonEditor.value = JSON.stringify(data, null, 2);
                jsonStatus.innerHTML = `<span style="color: var(--success-green);">
                    <i class="fas fa-check-circle"></i> Loaded ${filename} successfully
                </span>`;
            }
        } catch (error) {
            console.error('Error loading JSON:', error);
            jsonStatus.innerHTML = `<span style="color: var(--error-red);">
                <i class="fas fa-exclamation-circle"></i> Failed to load ${filename}
            </span>`;
        }
    }

    async saveJSON() {
        const fileSelect = document.getElementById('jsonFileSelect');
        const jsonEditor = document.getElementById('jsonEditor');
        const jsonStatus = document.getElementById('jsonStatus');
        
        if (!fileSelect || !jsonEditor) return;
        
        const filename = fileSelect.value;
        
        try {
            const jsonData = JSON.parse(jsonEditor.value);
            
            // Validate JSON structure
            const validationError = this.validateJSON(filename, jsonData);
            if (validationError) {
                jsonStatus.innerHTML = `<span style="color: var(--error-red);">
                    <i class="fas fa-exclamation-circle"></i> ${validationError}
                </span>`;
                return;
            }
            
            // Save to server
            const result = await this.api.saveData(filename, jsonData);
            
            if (result.success) {
                // Update current data
                const dataKey = filename.replace('.json', '');
                if (this.currentData[dataKey]) {
                    this.currentData[dataKey] = jsonData;
                }
                
                jsonStatus.innerHTML = `<span style="color: var(--success-green);">
                    <i class="fas fa-check-circle"></i> Saved ${filename} successfully
                </span>`;
                
                this.showToast('JSON file saved!');
                
                // Refresh the corresponding section
                this.refreshSectionData(dataKey);
                
                // Refresh main website data
                this.refreshMainWebsite();
            } else {
                throw new Error(result.error || 'Failed to save JSON');
            }
            
        } catch (error) {
            console.error('Error saving JSON:', error);
            jsonStatus.innerHTML = `<span style="color: var(--error-red);">
                <i class="fas fa-exclamation-circle"></i> ${error.message}
            </span>`;
        }
    }

    validateJSON(filename, data) {
        switch(filename) {
            case 'menu.json':
                if (!data.categories || !Array.isArray(data.categories)) {
                    return 'Menu data must have a categories array';
                }
                if (!data.items || !Array.isArray(data.items)) {
                    return 'Menu data must have an items array';
                }
                break;
            case 'specials.json':
                if (!data.specials || !Array.isArray(data.specials)) {
                    return 'Specials data must have a specials array';
                }
                break;
            case 'events.json':
                if (!data.events || !Array.isArray(data.events)) {
                    return 'Events data must have an events array';
                }
                break;
            case 'contact.json':
                if (!data.address || !data.phone || !data.email || 
                    !data.workingHours || !data.socialMedia) {
                    return 'Contact data is incomplete';
                }
                break;
            default:
                return null;
        }
        return null;
    }

    // ==================== HELPER METHODS ====================
    refreshMenuData() {
        this.api.clearCache();
        this.loadDataIndividually().then(() => {
            this.renderMenuTable();
            this.showToast('Menu data refreshed!');
        });
    }

    refreshSpecialsData() {
        this.api.clearCache();
        this.loadDataIndividually().then(() => {
            this.renderSpecialsTable();
            this.showToast('Specials data refreshed!');
        });
    }

    refreshEventsData() {
        this.api.clearCache();
        this.loadDataIndividually().then(() => {
            this.renderEventsTable();
            this.showToast('Events data refreshed!');
        });
    }

    refreshMainWebsite() {
        // In a real app, you might want to send a message to the main website
        // or trigger a refresh. For now, we'll just clear the cache.
        this.api.clearCache();
        
        // Optionally, you could open the main website in a new tab/window
        // window.open('/', '_blank');
    }

    resetMenuForm() {
        const form = document.getElementById('menuForm');
        if (form) form.reset();
        
        this.editingItem = null;
        
        const submitBtn = document.querySelector('#menuForm .btn-save');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Item';
            submitBtn.style.backgroundColor = '';
        }
    }

    resetSpecialForm() {
        const form = document.getElementById('specialForm');
        if (form) form.reset();
        
        this.editingSpecial = null;
        
        const submitBtn = document.querySelector('#specialForm .btn-save');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Special';
            submitBtn.style.backgroundColor = '';
        }
    }

    resetEventForm() {
        const form = document.getElementById('eventForm');
        if (form) form.reset();
        
        this.editingEvent = null;
        
        const submitBtn = document.querySelector('#eventForm .btn-save');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Event';
            submitBtn.style.backgroundColor = '';
        }
    }

    getNextId(items) {
        if (!items || items.length === 0) return 1;
        const maxId = Math.max(...items.map(item => item.id));
        return maxId + 1;
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        
        const toastMessage = toast.querySelector('.toast-message');
        const toastIcon = toast.querySelector('i');
        
        toastMessage.textContent = message;
        
        // Set icon and color based on type
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

// Initialize admin panel
let admin;
document.addEventListener('DOMContentLoaded', () => {
    admin = new AdminPanel();
    
    // Set up JSON file selector
    const jsonFileSelect = document.getElementById('jsonFileSelect');
    if (jsonFileSelect) {
        jsonFileSelect.addEventListener('change', () => {
            admin.loadSelectedJSON();
        });
    }
});

// Global functions for onclick handlers
function resetMenuForm() {
    if (admin) admin.resetMenuForm();
}

function resetSpecialForm() {
    if (admin) admin.resetSpecialForm();
}

function resetEventForm() {
    if (admin) admin.resetEventForm();
}

function saveJSON() {
    if (admin) admin.saveJSON();
}

function loadSelectedJSON() {
    if (admin) admin.loadSelectedJSON();
}

// Initialize DataAPI class (copied from main script)
class DataAPI {
    constructor() {
        this.basePath = 'data/';
        this.cache = new Map();
        this.cacheTime = 5 * 60 * 1000;
    }

    async fetchData(filename) {
        // Try to get from localStorage first (for admin edits)
        const localData = localStorage.getItem(`cafe_${filename}`);
        if (localData) {
            try {
                return JSON.parse(localData);
            } catch (error) {
                console.error('Error parsing localStorage data:', error);
            }
        }
        
        // Fall back to actual file
        try {
            const response = await fetch(`${this.basePath}${filename}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            return await response.json();
        } catch (error) {
            console.error(`Error fetching ${filename}:`, error);
            return null;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    admin = new AdminPanel();
    
    // Set up JSON file selector
    const jsonFileSelect = document.getElementById('jsonFileSelect');
    if (jsonFileSelect) {
        jsonFileSelect.addEventListener('change', () => {
            admin.loadSelectedJSON();
        });
    }
});

// Global functions for onclick handlers
function resetMenuForm() {
    if (admin) admin.resetMenuForm();
}

function resetSpecialForm() {
    if (admin) admin.resetSpecialForm();
}

function resetEventForm() {
    if (admin) admin.resetEventForm();
}

function saveJSON() {
    if (admin) admin.saveJSON();
}

function loadSelectedJSON() {
    if (admin) admin.loadSelectedJSON();
}