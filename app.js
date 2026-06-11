document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------
    // STATE MANAGEMENT
    // ----------------------------------------------------
    let state = {
        programmes: [
            { id: 'monthly', name: 'Monthly Sevadhari Programme', date: '2026-06-01', endDate: '2026-06-30', type: 'monthly' }
        ],
        pastProgrammes: [], // list of archived finished programmes
        // Rooms dictionary keyed by room number: e.g. '101'
        rooms: {},
        activeScreen: 'screen-home',
        selectedProgramme: null,
        
        // Active registration form state
        registration: {
            centreName: '',
            centrePhone: '',
            arrivalTime: '',
            mode: 'group', // group | individual
            category: 'bk', // bk | nbk
            type: 'guest', // guest | sevadhari
            nbkGuestType: 'guest', // guest | driver
            counts: {
                mata: 0,
                kumari: 0,
                teacher: 0,
                children: 0,
                adhar_kumar: 0,
                kumar: 0,
                nbk_female: 0,
                nbk_male: 0,
                nbk_children: 0,
                nbk_driver: 0
            },
            individuals: [], // array of { id, name, age, type, centre, phone }
            sevaAllocations: {} // { personId/index: department }
        },

        // Active room allotment state
        allotment: {
            remainingToAllot: {}, // e.g. { mata: 5, kumari: 2 }
            initialCounts: {}, // original counts for this session
            selectedCategories: [], // categories checked for placement right now
            tempAllocations: [], // array of { roomNum, adultCount, childCount }
            selectedRoomNum: null,
            allottedLog: [] // log of final allotments: { category, count, room }
        },
        showingReportIsPast: false,
        showingReportPastProg: null,
        
        // Dynamic Niwasi present/absent states
        niwasiStatus: {
            brothers: {
                'BK Vijaya Bhrata': true,
                'BK RamSagar': true,
                'BK Taranand': true,
                'BK Rahul': true,
                'BK Kamlesh': true,
                'BK Dharamchand': true,
                'Bk Sudhir': true,
                'BK Sishpal': false,
                'Bk Ajit': false
            },
            sisters: {
                'BK Bindu': true,
                'Bk Renu': true,
                'Bk Asha': true,
                'Bk Nitu': true,
                'Bk chitra': false,
                'Bk Jyoti': false,
                'Bk Yogshree': false
            },
            teachers: {
                'BK Prem Didi': true,
                'BK Luxmi Didi': true,
                'BK Uttra Didi': false,
                'Bk Vijaya Didi': false,
                'Bk anita Didi': false
            }
        },
        viewerPassword: 'viewer@src',
        currentUserRole: null
    };

    // ----------------------------------------------------
    // INITIALIZATION
    // ----------------------------------------------------
    function initRooms() {
        const floors = ['2', '3', '4', '5', 'D'];
        const cap4Rooms = ['306', '319', '203', '207', '214', '215', '216', '220', '221', '222', '223', '224', '225', '217', '218'];
        const acRooms = ['219', '213', '306', '203', '207', '214', '216', '217', '218', '319', '215', '315'];
        const geyserRooms = ['203', '207', '214', '216', '217', '218', '306', '319', '220', '404', '219'];
        const pantryRooms = ['208', '304'];
        const niwasiRooms = ['201', '202', '205', '206', '209', '210', '211', '212', '302', '305', '308', '309', '310', '311'];

        floors.forEach(floor => {
            // Block A rooms
            // Odd numbers: 1, 3, 5, 7, 9, 11
            const oddA = [1, 3, 5, 7, 9, 11];
            // Even numbers: 2, 4, 6, 8, 10, 12
            const evenA = [2, 4, 6, 8, 10, 12];

            // Block B rooms
            // Odd numbers: 13, 15, 17, 19, 21, 23
            const oddB = [13, 15, 17, 19, 21, 23];
            // Even numbers: 14, 16, 18, 20, 22, 24
            const evenB = [14, 16, 18, 20, 22, 24];

            const createRoom = (num, block) => {
                const roomNum = floor === 'D' ? `D${num}` : `${floor}${num.toString().padStart(2, '0')}`;
                
                // Driver floor has ONLY D1 and D2
                if (floor === 'D' && num > 2) return;
                
                let cap = 5;
                if (roomNum === '219') {
                    cap = 2;
                } else if (cap4Rooms.includes(roomNum)) {
                    cap = 4;
                }
                state.rooms[roomNum] = {
                    number: roomNum,
                    floor: floor,
                    block: block,
                    capacity: cap,
                    occupied: 0,
                    gender: null, // 'female' or 'male'
                    allocated: [], // array of persons
                    unmaintained: false,
                    maintenanceIssue: '',
                    ac: acRooms.includes(roomNum),
                    geyser: geyserRooms.includes(roomNum),
                    vip: roomNum === '219',
                    pantry: pantryRooms.includes(roomNum),
                    niwasi: niwasiRooms.includes(roomNum)
                };
            };

            oddA.forEach(num => createRoom(num, 'A'));
            evenA.forEach(num => createRoom(num, 'A'));
            oddB.forEach(num => createRoom(num, 'B'));
            evenB.forEach(num => createRoom(num, 'B'));
        });

        // Set a few default unmaintained rooms for demo
        state.rooms['204'].unmaintained = true;
        state.rooms['204'].maintenanceIssue = 'Electricity Problem';
        state.rooms['306'].unmaintained = true;
        state.rooms['306'].maintenanceIssue = 'Maintenance Issue';
    }

    function checkExpiredOccupants() {
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        let changed = false;

        Object.values(state.rooms).forEach(room => {
            const initialLen = room.allocated.length;

            room.allocated = room.allocated.filter(p => {
                if (p.departureDate) {
                    if (p.departureDate < todayStr) {
                        changed = true;
                        return false;
                    }
                }
                return true;
            });

            if (room.allocated.length !== initialLen) {
                const adults = room.allocated.filter(p => p.subcategory !== 'Children');
                room.occupied = adults.length;

                if (adults.length === 0) {
                    room.gender = null;
                } else {
                    const hasFemale = adults.some(p => ['Mata', 'Kumari', 'Female', 'BK Teacher'].includes(p.subcategory));
                    const hasMale = adults.some(p => ['Adhar Kumar', 'Kumar', 'Male', 'Driver'].includes(p.subcategory));
                    if (hasFemale) room.gender = 'female';
                    else if (hasMale) room.gender = 'male';
                    else room.gender = null;
                }
            }
        });

        if (changed) {
            updateDashboardStats();
            if (state.activeScreen === 'screen-room-map') {
                renderRoomMap('viz');
            } else if (state.activeScreen === 'screen-allotment') {
                renderRoomMap('allot');
            }
        }
    }

    // ----------------------------------------------------
    // DATA PERSISTENCE (localStorage & Firebase Sync)
    // ----------------------------------------------------
    const STORAGE_KEY = 'accommodation_app_state';
    let isFirebaseActive = false;
    let dbRef = null;
    let isWritingFirebase = false;
    let isFirebaseLoaded = false;

    function saveState(syncToFirebase = true) {
        try {
            const dataToSave = {
                rooms: state.rooms,
                programmes: state.programmes,
                pastProgrammes: state.pastProgrammes,
                registration: state.registration,
                allotment: {
                    allottedLog: state.allotment.allottedLog
                },
                niwasiStatus: state.niwasiStatus,
                selectedProgrammeId: state.selectedProgramme ? state.selectedProgramme.id : null,
                viewerPassword: state.viewerPassword
            };
            
            // Save locally, including local auth role
            const localData = { ...dataToSave, currentUserRole: state.currentUserRole };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(localData));

            // Sync with Firebase in real time if configured
            if (syncToFirebase && isFirebaseActive && dbRef && isFirebaseLoaded) {
                isWritingFirebase = true;
                dbRef.set(dataToSave).then(() => {
                    isWritingFirebase = false;
                }).catch(err => {
                    isWritingFirebase = false;
                    console.error('Firebase save error:', err);
                });
            }
        } catch (e) {
            console.warn('Could not save state:', e);
        }
    }

    function applyStateUpdate(data) {
        if (!data) return;

        // Restore rooms
        if (data.rooms) {
            Object.keys(data.rooms).forEach(roomNum => {
                if (state.rooms[roomNum]) {
                    state.rooms[roomNum].allocated = data.rooms[roomNum].allocated || [];
                    state.rooms[roomNum].occupied = data.rooms[roomNum].occupied || 0;
                    state.rooms[roomNum].gender = data.rooms[roomNum].gender || null;
                    state.rooms[roomNum].unmaintained = data.rooms[roomNum].unmaintained || false;
                    state.rooms[roomNum].maintenanceIssue = data.rooms[roomNum].maintenanceIssue || '';
                }
            });
        }

        // Restore programmes
        state.programmes = data.programmes || [
            { id: 'monthly', name: 'Monthly Sevadhari Programme', date: '2026-06-01', endDate: '2026-06-30', type: 'monthly' }
        ];
        state.pastProgrammes = data.pastProgrammes || [];

        // Restore registration
        if (data.registration) {
            state.registration = data.registration;
        }

        // Restore allotment log
        if (data.allotment && data.allotment.allottedLog) {
            state.allotment.allottedLog = data.allotment.allottedLog;
        }

        // Restore niwasi status
        if (data.niwasiStatus) {
            state.niwasiStatus = data.niwasiStatus;
        }

        // Restore selected programme
        if (data.selectedProgrammeId) {
            state.selectedProgramme = state.programmes.find(p => p.id === data.selectedProgrammeId) || null;
        }

        // Restore viewer password
        if (data.viewerPassword) {
            state.viewerPassword = data.viewerPassword;
        }

        // Restore current user role (from local storage data)
        if (data.currentUserRole !== undefined) {
            state.currentUserRole = data.currentUserRole;
        }
    }

    function loadState() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return;
            const data = JSON.parse(saved);
            applyStateUpdate(data);
            console.log('✅ State restored from localStorage');
        } catch (e) {
            console.warn('Could not load state from localStorage:', e);
        }
    }

    function refreshUI() {
        applyRoleSettings();
        renderProgrammes();
        renderPastProgrammes();
        updateDashboardStats();

        // Refresh dynamic components depending on the active screen
        if (state.activeScreen === 'screen-room-viz') {
            renderCentreWiseList();
        } else if (state.activeScreen === 'screen-room-map') {
            renderRoomMap('viz');
        } else if (state.activeScreen === 'screen-allotment') {
            renderAllotmentSummary();
            renderRoomMap('allot');
            updateAllotmentButtons();
        } else if (state.activeScreen === 'screen-seva') {
            renderSevaPersonsList();
        }
    }

    function initFirebase() {
        if (typeof firebase !== 'undefined' && typeof firebaseConfig !== 'undefined' && firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey !== 'YOUR_API_KEY') {
            try {
                firebase.initializeApp(firebaseConfig);
                dbRef = firebase.database().ref('accommodation_state');
                isFirebaseActive = true;
                console.log('🔥 Firebase Realtime Database connection active');

                // Listen to remote changes and sync automatically
                dbRef.on('value', (snapshot) => {
                    isFirebaseLoaded = true; // Mark as loaded!
                    if (isWritingFirebase) return; // Prevent loops
                    const remoteData = snapshot.val();
                    if (remoteData) {
                        applyStateUpdate(remoteData);
                        // Save latest remote data to local storage as fallback
                        try {
                            localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteData));
                        } catch (e) {}
                        refreshUI();
                        console.log('🔄 Remote data synced and UI updated');
                    }
                });
            } catch (e) {
                console.error('Firebase initialization failed:', e);
            }
        } else {
            console.log('ℹ️ Running in Local Storage Mode (Firebase not configured)');
        }
    }

    initRooms();
    loadState(); // Optimistic load: display cached local state immediately
    initFirebase(); // Connect to cloud database and sync if keys are set
    checkExpiredOccupants();
    renderProgrammes();
    renderPastProgrammes();
    updateDashboardStats();

    // Past Programmes Toggle
    const pastToggle = document.getElementById('past-programmes-toggle');
    const pastCard = document.getElementById('past-programmes-card');
    const pastContent = document.getElementById('past-programmes-content');

    pastToggle.addEventListener('click', () => {
        const isCollapsed = pastContent.classList.contains('hidden');
        if (isCollapsed) {
            pastContent.classList.remove('hidden');
            pastCard.classList.add('expanded');
        } else {
            pastContent.classList.add('hidden');
            pastCard.classList.remove('expanded');
        }
    });

    // Clear Past Programmes listener removed in favor of individual past program deletes

    // Finish Programme Action Click
    document.getElementById('btn-chooser-finish').addEventListener('click', () => {
        if (!state.selectedProgramme) return;

        const progName = state.selectedProgramme.name;
        if (!confirm(`Are you sure you want to finish the programme "${progName}"? \n\nThis will clear all current room occupancy allocations and save the programme report to Past Programmes history.`)) {
            return;
        }

        // Resolve names map for Ruhani Seva
        let resolvedNamesMap = {};
        const reg = state.registration;
        if (reg.mode === 'group') {
            const categories = ['mata', 'kumari', 'children', 'adhar_kumar', 'kumar'];
            const labels = { mata: 'Mata', kumari: 'Kumari', children: 'Children', adhar_kumar: 'Adhar Kumar', kumar: 'Kumar' };
            categories.forEach(cat => {
                const count = reg.counts[cat];
                for (let i = 1; i <= count; i++) {
                    resolvedNamesMap[`grp_${cat}_${i}`] = `${labels[cat]} #${i}`;
                }
            });
        } else {
            reg.individuals.forEach(p => {
                resolvedNamesMap[p.id] = p.name;
            });
        }

        // Create a snapshot of current rooms occupancy and occupant details
        const roomsSnapshot = {};
        Object.keys(state.rooms).forEach(roomNum => {
            const room = state.rooms[roomNum];
            if (room.allocated && room.allocated.length > 0) {
                roomsSnapshot[roomNum] = JSON.parse(JSON.stringify(room.allocated));
            }
        });

        // Save to past programmes list
        const pastProg = {
            id: state.selectedProgramme.id,
            name: state.selectedProgramme.name,
            date: state.selectedProgramme.date,
            type: state.selectedProgramme.type,
            finishDate: new Date().toLocaleDateString('en-IN'),
            centreName: state.registration.centreName,
            arrivalTime: state.registration.arrivalTime || getCurrentFormattedDateTime(),
            allottedLog: [...state.allotment.allottedLog],
            sevaAllocations: { ...state.registration.sevaAllocations },
            resolvedNamesMap: resolvedNamesMap,
            roomsSnapshot: roomsSnapshot
        };

        state.pastProgrammes.push(pastProg);

        // Remove from active list unless it's Monthly
        if (state.selectedProgramme.id === 'monthly') {
            // Re-id monthly archive to avoid duplicates
            pastProg.id = 'monthly_archived_' + Date.now();
        } else {
            state.programmes = state.programmes.filter(p => p.id !== state.selectedProgramme.id);
        }

        // Clear all room allocations!
        Object.values(state.rooms).forEach(room => {
            room.occupied = 0;
            room.gender = null;
            room.allocated = [];
        });

        // Reset active registration form
        resetRegistrationForm();

        // Close modal
        document.getElementById('modal-action-chooser').classList.remove('active');

        // Go home & refresh lists
        navigateTo('screen-home');
        renderPastProgrammes();
        updateDashboardStats();
    });

    // Quick Stats click handlers to open details popup
    document.getElementById('btn-stat-total').addEventListener('click', () => openSummaryDetailsModal('total'));
    document.getElementById('btn-stat-guests').addEventListener('click', () => openSummaryDetailsModal('guest'));
    document.getElementById('btn-stat-sevadharis').addEventListener('click', () => openSummaryDetailsModal('sevadhari'));
    document.getElementById('btn-stat-niwasis').addEventListener('click', () => openSummaryDetailsModal('niwasi'));
    document.getElementById('btn-stat-nbks').addEventListener('click', () => openSummaryDetailsModal('nbk'));

    // Share Occupant Summary to WhatsApp click handler
    document.getElementById('btn-share-dashboard-summary').addEventListener('click', shareDashboardSummary);

    // Close listener for summary details modal
    document.getElementById('btn-close-summary-details').addEventListener('click', () => {
        document.getElementById('modal-occupant-summary-details').classList.remove('active');
    });

    // Close listener for niwasi category details modal
    const closeNiwasiCatDetailsBtn = document.getElementById('btn-close-niwasi-cat-details');
    if (closeNiwasiCatDetailsBtn) {
        closeNiwasiCatDetailsBtn.addEventListener('click', () => {
            document.getElementById('modal-niwasi-category-details').classList.remove('active');
        });
    }

    // Report Stats click handlers to open details popup
    document.getElementById('btn-report-stat-total').addEventListener('click', () => {
        openSummaryDetailsModal('total', state.showingReportIsPast, state.showingReportPastProg);
    });
    document.getElementById('btn-report-stat-guests').addEventListener('click', () => {
        openSummaryDetailsModal('guest', state.showingReportIsPast, state.showingReportPastProg);
    });
    document.getElementById('btn-report-stat-sevadharis').addEventListener('click', () => {
        openSummaryDetailsModal('sevadhari', state.showingReportIsPast, state.showingReportPastProg);
    });
    document.getElementById('btn-report-stat-nbks').addEventListener('click', () => {
        openSummaryDetailsModal('nbk', state.showingReportIsPast, state.showingReportPastProg);
    });

    function matchesLabel(p, label) {
        if (!p || !label) return false;
        const sub = p.subcategory;
        const cat = p.category;
        const type = p.type;

        // Total category matches
        if (label.startsWith('BK ')) {
            if (cat !== 'bk') return false;
            let targetSub = label.replace('BK ', '');
            if (targetSub === 'Teacher') return sub === 'BK Teacher';
            return sub === targetSub;
        }
        if (label.startsWith('NBK ')) {
            if (cat !== 'nbk') return false;
            let targetSub = label.replace('NBK ', '');
            return sub === targetSub;
        }

        // Guest category matches
        if (label.startsWith('Guest ')) {
            if (type !== 'guest' && type !== 'driver') return false;
            let targetSub = label.replace('Guest ', '');
            if (targetSub.endsWith(' (NBK)')) {
                targetSub = targetSub.replace(' (NBK)', '');
                return cat === 'nbk' && sub === targetSub;
            }
            if (targetSub === 'BK Teacher') return cat === 'bk' && sub === 'BK Teacher';
            return cat === 'bk' && sub === targetSub;
        }

        // Sevadhari category matches
        if (label.startsWith('Sevadhari ')) {
            if (type !== 'sevadhari') return false;
            let targetSub = label.replace('Sevadhari ', '');
            return sub === targetSub;
        }

        return false;
    }

    function openSubcategoryCentresModal(label, categoryType, isPast, pastProg, allocatedArray) {
        const modal = document.getElementById('modal-niwasi-category-details');
        const titleEl = document.getElementById('modal-niwasi-cat-title');
        const contentEl = document.getElementById('modal-niwasi-cat-content');

        if (!modal || !titleEl || !contentEl) return;

        // Filter matched occupants for this subcategory
        const matched = allocatedArray.filter(p => matchesLabel(p, label));

        // Group by Centre
        const centreCounts = {};
        matched.forEach(p => {
            const c = p.centre || 'Unknown';
            centreCounts[c] = (centreCounts[c] || 0) + 1;
        });

        titleEl.textContent = `${label} - Centres`;
        contentEl.innerHTML = '';

        Object.keys(centreCounts).forEach(centreName => {
            const count = centreCounts[centreName];
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.padding = '12px 14px';
            row.style.background = 'rgba(0, 0, 0, 0.02)';
            row.style.borderRadius = '8px';
            row.style.marginBottom = '6px';
            row.style.border = '1px solid rgba(0, 0, 0, 0.05)';
            row.style.cursor = 'pointer';

            row.innerHTML = `
                <span style="font-weight: 800; color: #000000; font-size: 15px;">${centreName}</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <strong style="color: var(--accent-blue); font-size: 16px;">${count}</strong>
                    <span style="color: #64748b; font-size: 11px;">▶</span>
                </div>
            `;

            row.addEventListener('click', () => {
                openSubcategoryOccupantsModal(label, categoryType, isPast, pastProg, matched, centreName);
            });

            contentEl.appendChild(row);
        });

        modal.classList.add('active');
    }

    function openSubcategoryOccupantsModal(label, categoryType, isPast, pastProg, matched, centreName) {
        const modal = document.getElementById('modal-subcategory-occupants-list');
        const titleEl = document.getElementById('modal-subcat-occupants-title');
        const contentEl = document.getElementById('modal-subcat-occupants-content');

        if (!modal || !titleEl || !contentEl) return;

        // Filter matched occupants for this centre
        const finalMatched = matched.filter(p => (p.centre || 'Unknown') === centreName);

        titleEl.textContent = `${label} from ${centreName}`;
        contentEl.innerHTML = '';

        if (finalMatched.length === 0) {
            contentEl.innerHTML = '<div style="color: #94a3b8; font-style: italic; text-align: center; padding: 15px 0;">No occupants found.</div>';
        } else {
            finalMatched.forEach((p, idx) => {
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.justifyContent = 'space-between';
                row.style.alignItems = 'center';
                row.style.padding = '10px 0';
                row.style.borderBottom = '1px solid rgba(0, 0, 0, 0.05)';

                // Resolve display name
                let displayName = p.name;
                if (!displayName) {
                    if (p.id && p.id.startsWith('grp_')) {
                        const parts = p.id.split('_');
                        const index = parts[parts.length - 1];
                        displayName = `${p.subcategory} (${index})`;
                    } else {
                        displayName = `${p.subcategory} (${idx + 1})`;
                    }
                }
                row.innerHTML = `
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-weight: 800; color: #000000; font-size: 14px;">${displayName}</span>
                        <span style="color: #64748b; font-size: 11px;">🕒 ${p.arrivalTime || 'Unknown'}</span>
                    </div>
                    <span style="font-weight: 700; color: var(--accent-indigo); font-size: 14px; background: rgba(79, 70, 229, 0.1); padding: 4px 10px; border-radius: 20px;">Room ${p.roomNum}</span>
                `;
                contentEl.appendChild(row);
            });
        }

        modal.classList.add('active');
        
        // Listen to close button
        const closeBtn = document.getElementById('btn-close-subcat-occupants');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.remove('active');
            });
        }
    }

    function openSummaryDetailsModal(type, isPast = false, pastProg = null) {
        const modal = document.getElementById('modal-occupant-summary-details');
        const titleEl = document.getElementById('modal-summary-title');
        const contentEl = document.getElementById('modal-summary-details-content');

        if (!modal || !titleEl || !contentEl) return;

        let title = '';
        let breakdown = {};
        let keys = [];

        // Build flat array of all allocated occupants from rooms or archived roomsSnapshot
        const allocatedArray = [];
        if (isPast && pastProg) {
            const snapshot = pastProg.roomsSnapshot || {};
            Object.keys(snapshot).forEach(roomNum => {
                const occupants = snapshot[roomNum] || [];
                occupants.forEach(p => {
                    allocatedArray.push({ ...p, roomNum: roomNum });
                });
            });
        } else {
            Object.keys(state.rooms).forEach(roomNum => {
                const occupants = state.rooms[roomNum].allocated || [];
                occupants.forEach(p => {
                    allocatedArray.push({ ...p, roomNum: roomNum });
                });
            });
        }

        if (type === 'total') {
            title = 'Total Occupants';
            breakdown = { 'BK Mata': 0, 'BK Kumari': 0, 'BK Teacher': 0, 'BK Kumar': 0, 'BK Adhar Kumar': 0, 'BK Children': 0, 'NBK Male': 0, 'NBK Female': 0, 'NBK Children': 0, 'NBK Driver': 0 };
            keys = Object.keys(breakdown);
            
            allocatedArray.forEach(p => {
                const sub = p.subcategory;
                const cat = p.category;
                if (cat === 'bk') {
                    const label = sub === 'BK Teacher' ? 'BK Teacher' : `BK ${sub}`;
                    if (breakdown[label] !== undefined) breakdown[label]++;
                } else {
                    const label = `NBK ${sub}`;
                    if (breakdown[label] !== undefined) breakdown[label]++;
                }
            });
        } else if (type === 'guest') {
            title = 'Guest Breakdown';
            breakdown = { 'Guest Mata': 0, 'Guest Kumari': 0, 'Guest BK Teacher': 0, 'Guest Kumar': 0, 'Guest Adhar Kumar': 0, 'Guest Children': 0, 'Guest Male (NBK)': 0, 'Guest Female (NBK)': 0, 'Guest Children (NBK)': 0 };
            keys = Object.keys(breakdown);
            
            allocatedArray.forEach(p => {
                if (p.type !== 'guest' && p.type !== 'driver') return;
                const sub = p.subcategory;
                const cat = p.category;
                if (cat === 'bk') {
                    const label = `Guest ${sub}`;
                    if (breakdown[label] !== undefined) breakdown[label]++;
                } else {
                    if (sub === 'Driver') return;
                    const label = `Guest ${sub} (NBK)`;
                    if (breakdown[label] !== undefined) breakdown[label]++;
                }
            });
        } else if (type === 'sevadhari') {
            title = 'Sevadhari Breakdown';
            breakdown = { 'Sevadhari Mata': 0, 'Sevadhari Kumari': 0, 'Sevadhari Kumar': 0, 'Sevadhari Adhar Kumar': 0, 'Sevadhari Children': 0 };
            keys = Object.keys(breakdown);
            
            allocatedArray.forEach(p => {
                if (p.type !== 'sevadhari') return;
                const sub = p.subcategory;
                const label = `Sevadhari ${sub}`;
                if (breakdown[label] !== undefined) breakdown[label]++;
            });
        } else if (type === 'niwasi') {
            title = 'Niwasi Breakdown';
            renderNiwasiBreakdownInModal(contentEl);
            titleEl.textContent = title;
            modal.classList.add('active');
            return;
        } else if (type === 'nbk') {
            title = 'Non-BK Breakdown';
            breakdown = { 'NBK Male': 0, 'NBK Female': 0, 'NBK Children': 0, 'NBK Driver': 0 };
            keys = Object.keys(breakdown);
            
            allocatedArray.forEach(p => {
                if (p.category !== 'nbk') return;
                const sub = p.subcategory;
                const label = `NBK ${sub}`;
                if (breakdown[label] !== undefined) breakdown[label]++;
            });
        }

        titleEl.textContent = title;
        contentEl.innerHTML = '';

        let hasAny = false;
        keys.forEach(key => {
            const count = breakdown[key] || 0;
            if (count > 0) hasAny = true;
            
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.padding = '10px 0';
            row.style.borderBottom = '1px solid rgba(15, 23, 42, 0.05)';
            row.style.opacity = count > 0 ? '1' : '0.4';
            row.style.cursor = count > 0 ? 'pointer' : 'default';
            
            row.innerHTML = `
                <span style="font-weight: ${count > 0 ? '700' : '400'}; color: var(--text-primary); font-size: 15px;">${key}</span>
                <div style="display:flex; align-items:center; gap: 8px;">
                    <strong style="color: ${count > 0 ? 'var(--accent-indigo)' : 'var(--text-muted)'}; font-size: 16px;">${count}</strong>
                    ${count > 0 ? '<span style="color:#64748b; font-size:11px;">▶</span>' : ''}
                </div>
            `;

            if (count > 0) {
                row.addEventListener('click', () => {
                    openSubcategoryCentresModal(key, type, isPast, pastProg, allocatedArray);
                });
            }
            contentEl.appendChild(row);
        });

        if (!hasAny) {
            contentEl.innerHTML = '<div style="color:var(--text-muted); font-style:italic; text-align:center; padding:18px 0; font-size: 15px;">No occupants registered in this category.</div>';
        }

        modal.classList.add('active');
    }

    function shareDashboardSummary() {
        let filledBeds = 0;
        let bkTotal = 0;
        let bkSub = { Mata: 0, Kumari: 0, "Adhar Kumar": 0, Kumar: 0, Children: 0 };
        let nbkTotal = 0;
        let nbkSub = { Male: 0, Female: 0, Children: 0, Driver: 0 };
        
        let guestTotal = 0;
        let guestSub = { Mata: 0, Kumari: 0, "BK Teacher": 0, Kumar: 0, Children: 0, "Adhar Kumar": 0 };
        let nbkDriverGuestCount = 0;
        let sevaTotal = 0;
        let sevaSub = { Mata: 0, Kumari: 0, "Adhar Kumar": 0, Kumar: 0, Children: 0 };
        const niwasiCounts = getDynamicNiwasiCounts();
        let niwasiTotal = niwasiCounts.total;
        let niwasiSub = { Brother: niwasiCounts.brother, Sister: niwasiCounts.sister, "Senior Teacher": niwasiCounts.teacher };

        Object.values(state.rooms).forEach(room => {
            room.allocated.forEach(p => {
                const sub = p.subcategory;
                const cat = p.category;
                const type = p.type;

                if (cat === 'bk') {
                    bkTotal++;
                    if (bkSub[sub] !== undefined) bkSub[sub]++;
                    
                    if (type === 'guest') {
                        guestTotal++;
                        if (guestSub[sub] !== undefined) guestSub[sub]++;
                    } else if (type === 'sevadhari') {
                        sevaTotal++;
                        if (sevaSub[sub] !== undefined) sevaSub[sub]++;
                    }
                } else {
                    nbkTotal++;
                    if (nbkSub[sub] !== undefined) nbkSub[sub]++;
                    
                    if (type === 'driver') {
                        guestTotal++;
                        nbkDriverGuestCount++;
                    }
                }
            });
        });

        filledBeds = guestTotal + sevaTotal + niwasiTotal + nbkTotal;

        const todayStr = formatDateToDDMonthYear(new Date().toISOString().split('T')[0]);

        let text = `━━━━━━━━━━━━━━━━━━━\n`;
        text += `🏨 *ACCOMMODATION SUMMARY*\n`;
        text += `📅 *Date:* ${todayStr}\n`;
        text += `━━━━━━━━━━━━━━━━━━━\n\n`;
        
        text += `👥 *Total Occupants:* ${filledBeds} Persons\n\n`;

        if (guestTotal > 0) {
            text += `🔹 *Guests:* ${guestTotal}\n`;
            if (guestSub.Mata > 0) text += `  • BK Mata: ${guestSub.Mata}\n`;
            if (guestSub.Kumari > 0) text += `  • BK Kumari: ${guestSub.Kumari}\n`;
            if (guestSub['BK Teacher'] > 0) text += `  • BK Teacher: ${guestSub['BK Teacher']}\n`;
            if (guestSub.Kumar > 0) text += `  • BK Kumar: ${guestSub.Kumar}\n`;
            if (guestSub['Adhar Kumar'] > 0) text += `  • BK Adhar Kumar: ${guestSub['Adhar Kumar']}\n`;
            if (guestSub.Children > 0) text += `  • BK Children: ${guestSub.Children}\n`;
            if (nbkDriverGuestCount > 0) text += `  • Non-BK Driver: ${nbkDriverGuestCount}\n`;
            text += `\n`;
        }

        if (sevaTotal > 0) {
            text += `🛠️ *Sevadharis:* ${sevaTotal}\n`;
            if (sevaSub.Mata > 0) text += `  • BK Mata: ${sevaSub.Mata}\n`;
            if (sevaSub.Kumari > 0) text += `  • BK Kumari: ${sevaSub.Kumari}\n`;
            if (sevaSub.Kumar > 0) text += `  • BK Kumar: ${sevaSub.Kumar}\n`;
            if (sevaSub['Adhar Kumar'] > 0) text += `  • BK Adhar Kumar: ${sevaSub['Adhar Kumar']}\n`;
            if (sevaSub.Children > 0) text += `  • BK Children: ${sevaSub.Children}\n`;
            text += `\n`;
        }

        if (niwasiTotal > 0) {
            text += `🏠 *Niwasis:* ${niwasiTotal}\n`;
            if (niwasiSub.Brother > 0) text += `  • BK Brother: ${niwasiSub.Brother}\n`;
            if (niwasiSub.Sister > 0) text += `  • BK Sister: ${niwasiSub.Sister}\n`;
            if (niwasiSub["Senior Teacher"] > 0) text += `  • Senior Teacher: ${niwasiSub["Senior Teacher"]}\n`;
            text += `\n`;
        }

        if (nbkTotal > 0) {
            text += `👤 *Non-BK (NBK):* ${nbkTotal}\n`;
            if (nbkSub.Male > 0) text += `  • Male: ${nbkSub.Male}\n`;
            if (nbkSub.Female > 0) text += `  • Female: ${nbkSub.Female}\n`;
            if (nbkSub.Driver > 0) text += `  • Driver: ${nbkSub.Driver}\n`;
            if (nbkSub.Children > 0) text += `  • Children: ${nbkSub.Children}\n`;
            text += `\n`;
        }

        text += `━━━━━━━━━━━━━━━━━━━\n`;
        text += `_Generated via Accommodation SRC App_`;

        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text.trim())}`, '_blank');
    }

    // Set virtual status bar time to current local time
    function updateStatusBarTime() {
        const timeEl = document.getElementById('status-time');
        const now = new Date();
        const hrs = now.getHours().toString().padStart(2, '0');
        const mins = now.getMinutes().toString().padStart(2, '0');
        if (timeEl) timeEl.textContent = `${hrs}:${mins}`;
    }
    updateStatusBarTime();
    setInterval(updateStatusBarTime, 60000);

    // ----------------------------------------------------
    // SPA ROUTING
    // ----------------------------------------------------
    function navigateTo(screenId) {
        checkExpiredOccupants();
        // Hide all screens
        document.querySelectorAll('.screen').forEach(scr => {
            scr.classList.remove('active');
        });
        
        // Show target screen
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
            state.activeScreen = screenId;
        }

        // Toggle Departure Date field visibility on registration screen
        if (screenId === 'screen-register') {
            const depGroup = document.getElementById('group-departure-date');
            if (depGroup) {
                if (state.selectedProgramme && state.selectedProgramme.type === 'monthly') {
                    depGroup.classList.remove('hidden');
                } else {
                    depGroup.classList.add('hidden');
                }
            }
        }

        // Hook for screen-specific render logic on navigation
        if (screenId === 'screen-room-viz') {
            renderCentreWiseList();
        } else if (screenId === 'screen-room-map') {
            renderRoomMap('viz');
        } else if (screenId === 'screen-allotment') {
            renderAllotmentSummary();
            renderRoomMap('allot');
            updateAllotmentButtons();
        } else if (screenId === 'screen-seva') {
            renderSevaPersonsList();
        } else if (screenId === 'screen-home') {
            updateDashboardStats();
            renderProgrammes();
        }
    }

    // ----------------------------------------------------
    // STATS & PROGRAMME RENDERING
    // ----------------------------------------------------
    function updateDashboardStats() {
        let filledBeds = 0;
        let guestTotal = 0;
        let sevaTotal = 0;
        let niwasiTotal = getDynamicNiwasiTotal();
        let nbkTotal = 0;

        Object.values(state.rooms).forEach(room => {
            room.allocated.forEach(p => {
                const cat = p.category;
                const type = p.type;

                if (cat === 'bk') {
                    if (type === 'guest') guestTotal++;
                    else if (type === 'sevadhari') sevaTotal++;
                } else {
                    nbkTotal++;
                    if (type === 'driver') guestTotal++; // Non-BK driver counts as guest/driver
                }
            });
        });

        // Total sum of all categories including permanent Niwasis
        filledBeds = guestTotal + sevaTotal + niwasiTotal + nbkTotal;

        // Set main stat text content on stats card
        document.getElementById('stat-total-people').textContent = filledBeds;
        document.getElementById('stat-total-guests').textContent = guestTotal;
        document.getElementById('stat-total-sevadharis').textContent = sevaTotal;
        document.getElementById('stat-total-niwasis').textContent = niwasiTotal;
        document.getElementById('stat-total-nbks').textContent = nbkTotal;
        saveState();
    }

    function renderProgrammes() {
        const container = document.getElementById('programmes-list-container');
        container.innerHTML = '';

        // Separate monthly and regular programmes so monthly is always at the bottom
        const regulars = state.programmes.filter(p => p.type !== 'monthly');
        const monthlies = state.programmes.filter(p => p.type === 'monthly');
        const sortedProgrammes = [...regulars, ...monthlies];

        sortedProgrammes.forEach(prog => {
            const card = document.createElement('div');
            card.className = 'programme-card';
            const dateText = prog.endDate ? `Dates: ${prog.date} to ${prog.endDate}` : `Starts: ${prog.date}`;
            card.innerHTML = `
                <div class="prog-info">
                    <h3>${prog.name}</h3>
                    <p>${dateText}</p>
                </div>
                <span class="prog-badge ${prog.type}">${prog.type}</span>
            `;

            card.addEventListener('click', () => {
                state.selectedProgramme = prog;
                document.getElementById('chooser-modal-title').textContent = prog.name;
                document.getElementById('modal-action-chooser').classList.add('active');
            });

            container.appendChild(card);
        });
    }

    function renderPastProgrammes() {
        const container = document.getElementById('past-programmes-list-container');
        container.innerHTML = '';
        
        document.getElementById('past-programmes-count').textContent = state.pastProgrammes.length;

        if (state.pastProgrammes.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#64748b; font-size:12px; padding:10px 0;">No past programmes.</p>';
            return;
        }

        const isViewer = state.currentUserRole === 'viewer';

        state.pastProgrammes.forEach(prog => {
            const card = document.createElement('div');
            card.className = 'programme-card';
            
            const deleteBtnHtml = isViewer ? '' : `
                <button class="btn-delete-past-prog" title="Delete Past Programme" style="margin-left: 8px;">
                    <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>
            `;

            card.innerHTML = `
                <div class="prog-info" style="flex: 1;">
                    <h3>${prog.name}</h3>
                    <p>Finished: ${prog.finishDate} | Centre: ${prog.centreName}</p>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="prog-badge monthly" style="margin-right: 0;">Past</span>
                    ${deleteBtnHtml}
                </div>
            `;

            card.addEventListener('click', () => {
                // Open report in read-only past mode
                generateReportView(true, prog);
                navigateTo('screen-report');
            });

            // Bind individual delete button
            const delBtn = card.querySelector('.btn-delete-past-prog');
            if (delBtn) {
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent opening report
                    
                    if (state.currentUserRole === 'viewer') {
                        alert('Viewers cannot delete past programmes.');
                        return;
                    }
                    
                    if (confirm(`Are you sure you want to delete the past programme "${prog.name}"?`)) {
                        state.pastProgrammes = state.pastProgrammes.filter(p => p.id !== prog.id);
                        saveState();
                        renderPastProgrammes();
                    }
                });
            }

            container.appendChild(card);
        });
    }

    // Add programme modal triggers
    document.getElementById('btn-add-programme-trigger').addEventListener('click', () => {
        document.getElementById('modal-add-programme').classList.add('active');
    });

    document.getElementById('btn-close-add-prog').addEventListener('click', () => {
        document.getElementById('modal-add-programme').classList.remove('active');
    });

    document.getElementById('btn-save-new-programme').addEventListener('click', () => {
        const nameInput = document.getElementById('new-prog-name');
        const dateInput = document.getElementById('new-prog-date');
        const endDateInput = document.getElementById('new-prog-end-date');

        if (!nameInput.value || !dateInput.value || !endDateInput.value) {
            alert('Please enter Name, Start Date, and End Date.');
            return;
        }

        if (endDateInput.value < dateInput.value) {
            alert('End Date must be on or after Start Date.');
            return;
        }

        const newProg = {
            id: 'prog_' + Date.now(),
            name: nameInput.value,
            date: dateInput.value,
            endDate: endDateInput.value,
            type: 'regular'
        };

        state.programmes.push(newProg);
        nameInput.value = '';
        dateInput.value = '';
        endDateInput.value = '';
        document.getElementById('modal-add-programme').classList.remove('active');
        renderProgrammes();
        saveState();
    });

    // ----------------------------------------------------
    // ROOM MAP RENDERING & INTERACTION
    // ----------------------------------------------------
    let activeVizFloor = '2';
    let activeVizBlock = 'A';
    let activeAllotFloor = '2';
    let activeAllotBlock = 'A';

    function renderRoomMap(context) {
        const floor = context === 'viz' ? activeVizFloor : activeAllotFloor;
        const block = context === 'viz' ? activeVizBlock : activeAllotBlock;
        
        // Hide block selector container if floor is Driver 'D'
        const blockContainer = document.getElementById(`${context}-block-selector-container`);
        if (blockContainer) {
            if (floor === 'D') {
                blockContainer.classList.add('hidden');
            } else {
                blockContainer.classList.remove('hidden');
            }
        }
        
        const leftContainer = document.getElementById(`${context}-rooms-left`);
        const rightContainer = document.getElementById(`${context}-rooms-right`);

        if (!leftContainer || !rightContainer) return;

        leftContainer.innerHTML = '';
        rightContainer.innerHTML = '';

        // Filter rooms belonging to current floor
        // If floor is 'D', display all driver rooms (ignore block filter)
        const floorRooms = Object.values(state.rooms).filter(r => 
            r.floor === floor && (floor === 'D' ? true : r.block === block)
        );

        floorRooms.forEach(room => {
            const roomEl = document.createElement('div');
            roomEl.className = 'room-card-box';
            
            // Set styles based on gender/maintenance/pantry/niwasi
            if (room.unmaintained) {
                roomEl.classList.add('status-unmaintained');
            } else if (room.pantry) {
                roomEl.classList.add('status-pantry');
            } else if (room.niwasi) {
                roomEl.classList.add('status-niwasi');
            } else if (room.gender === 'female') {
                roomEl.classList.add('gender-female');
            } else if (room.gender === 'male') {
                roomEl.classList.add('gender-male');
            }

            // If selected room in allotment view
            if (context === 'allot') {
                const isTempSelected = state.allotment.tempAllocations.some(t => t.roomNum === room.number);
                if (isTempSelected) {
                    roomEl.classList.add('selected-target');
                }
            }

            // Show Corner badges (Full, Issue, Pantry, AC, VIP)
            let fullBadgeHtml = '';
            let acBadgeHtml = room.ac ? `<span class="room-ac-badge">AC ❄️</span>` : '';
            let vipBadgeHtml = room.vip ? `<span class="room-vip-badge">VIP ⭐</span>` : '';
            
            if (room.pantry) {
                fullBadgeHtml = `<span class="room-full-badge" style="background:#475569;">Pantry</span>`;
            } else if (room.niwasi) {
                fullBadgeHtml = `<span class="room-full-badge" style="background:#64748b;">Src Niwasi</span>`;
            } else if (room.occupied >= room.capacity) {
                fullBadgeHtml = `<span class="room-full-badge">Full</span>`;
            } else if (room.unmaintained) {
                fullBadgeHtml = `<span class="room-full-badge" style="background:#ef4444;">Issue</span>`;
            }

            let occupancyText = room.pantry ? 'Pantry Room' : (room.niwasi ? 'Src Niwasi' : `${room.occupied}/${room.capacity} beds`);
            let geyserBadgeHtml = room.geyser ? `<span class="room-geyser-badge">Geyser <svg viewBox="0 0 24 24" width="8" height="8" style="vertical-align: middle; fill: currentColor; margin-left: 2px;"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg></span>` : '';

            // Render room detail
            roomEl.innerHTML = `
                ${fullBadgeHtml}
                ${acBadgeHtml}
                ${geyserBadgeHtml}
                ${vipBadgeHtml}
                <span class="room-num">${room.number}</span>
                <span class="room-occupancy">${occupancyText}</span>
            `;

            // Setup click events
            if (context === 'viz') {
                // Room Visualization click -> Maintenance Setup
                roomEl.addEventListener('click', () => {
                    openMaintenanceModal(room.number);
                });
            } else {
                // Room Allotment click -> Select for placement
                roomEl.addEventListener('click', () => {
                    selectRoomForAllotment(room.number);
                });
            }

            // Place in Left Side (Odd) or Right Side (Even)
            const lastDigits = parseInt(room.number.replace(/\D/g, ''));
            if (lastDigits % 2 !== 0) {
                leftContainer.appendChild(roomEl);
            } else {
                rightContainer.appendChild(roomEl);
            }
        });
    }

    document.querySelectorAll('#allot-floor-tabs .floor-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('#allot-floor-tabs .floor-tab').forEach(t => t.classList.remove('active'));
            e.currentTarget.classList.add('active');
            activeAllotFloor = e.currentTarget.dataset.floor;
            renderRoomMap('allot');
            if (state.allotment.selectedRoomNum) {
                // Refresh room panel
                selectRoomForAllotment(state.allotment.selectedRoomNum);
            }
        });
    });

    document.getElementById('btn-allot-block-a').addEventListener('click', (e) => {
        document.getElementById('btn-allot-block-a').classList.add('active');
        document.getElementById('btn-allot-block-b').classList.remove('active');
        activeAllotBlock = 'A';
        renderRoomMap('allot');
        if (state.allotment.selectedRoomNum) {
            selectRoomForAllotment(state.allotment.selectedRoomNum);
        }
    });
    document.getElementById('btn-allot-block-b').addEventListener('click', (e) => {
        document.getElementById('btn-allot-block-a').classList.remove('active');
        document.getElementById('btn-allot-block-b').classList.add('active');
        activeAllotBlock = 'B';
        renderRoomMap('allot');
        if (state.allotment.selectedRoomNum) {
            selectRoomForAllotment(state.allotment.selectedRoomNum);
        }
    });

    document.querySelectorAll('#viz-floor-tabs .floor-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('#viz-floor-tabs .floor-tab').forEach(t => t.classList.remove('active'));
            e.currentTarget.classList.add('active');
            activeVizFloor = e.currentTarget.dataset.floor;
            renderRoomMap('viz');
        });
    });

    document.getElementById('btn-viz-block-a').addEventListener('click', (e) => {
        document.getElementById('btn-viz-block-a').classList.add('active');
        document.getElementById('btn-viz-block-b').classList.remove('active');
        activeVizBlock = 'A';
        renderRoomMap('viz');
    });
    document.getElementById('btn-viz-block-b').addEventListener('click', (e) => {
        document.getElementById('btn-viz-block-a').classList.remove('active');
        document.getElementById('btn-viz-block-b').classList.add('active');
        activeVizBlock = 'B';
        renderRoomMap('viz');
    });

    // ----------------------------------------------------
    // MAINTENANCE MODAL
    // ----------------------------------------------------
    let selectedMaintRoom = null;

    function formatDateToDDMonthYear(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        const year = parts[0];
        const monthIndex = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        
        const monthNames = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];
        
        const monthName = monthNames[monthIndex] || '';
        return `${day} ${monthName} ${year}`;
    }

    function openMaintenanceModal(roomNum) {
        selectedMaintRoom = roomNum;
        const room = state.rooms[roomNum];
        document.getElementById('modal-maint-room-number').textContent = roomNum;
        document.getElementById('maint-checkbox').checked = room.unmaintained;
        document.getElementById('maint-issue-select').value = room.maintenanceIssue || '';
        
        // Show/Hide maintenance editing controls based on role
        const isViewer = state.currentUserRole === 'viewer';
        document.getElementById('maint-divider').style.display = isViewer ? 'none' : 'block';
        document.getElementById('maint-checkbox-container').style.display = isViewer ? 'none' : 'block';
        document.getElementById('maint-issue-container').style.display = isViewer ? 'none' : 'block';
        document.getElementById('btn-save-maintenance').style.display = isViewer ? 'none' : 'block';

        // Populate current occupants list grouped by centre
        const occupantsContainer = document.getElementById('modal-room-occupants');
        occupantsContainer.innerHTML = '';

        if (room.allocated.length === 0) {
            occupantsContainer.innerHTML = '<div style="color: #94a3b8; font-style: italic; text-align: center;">Empty Room</div>';
        } else {
            room.allocated.forEach((p, idx) => {
                const formattedDepDate = p.departureDate ? formatDateToDDMonthYear(p.departureDate) : '';
                const depStr = formattedDepDate ? ` (Departs: ${formattedDepDate})` : '';
                const personDiv = document.createElement('div');
                personDiv.style.display = 'flex';
                personDiv.style.alignItems = 'center';
                personDiv.style.justifyContent = 'space-between';
                personDiv.style.marginBottom = '8px';
                if (idx < room.allocated.length - 1) {
                    personDiv.style.borderBottom = '1px solid rgba(15, 23, 42, 0.08)';
                    personDiv.style.paddingBottom = '8px';
                }
                
                const catStr = p.category ? p.category.toUpperCase() : '';
                const typeStr = p.type ? p.type : '';
                const nameDisplay = p.name ? `${p.name} (${p.subcategory})` : p.subcategory;
                
                // Do not render edit/delete buttons for viewers
                const editBtnHtml = isViewer ? '' : `
                    <button class="btn-edit-occupant" data-idx="${idx}" title="Edit / Transfer Occupant">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                    </button>
                `;
                
                const deleteBtnHtml = isViewer ? '' : `
                    <button class="btn-delete-occupant" data-idx="${idx}" title="Remove Occupant">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </button>
                `;

                personDiv.innerHTML = `
                    <div style="flex: 1; padding-right: 8px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px;">
                            <strong style="color: #000000; font-weight: 700;">${p.centre || 'Unknown'}</strong>
                            <span style="color: var(--text-secondary); font-weight: 600;">${catStr} ${typeStr.toUpperCase()}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:2px;">
                            <span style="color: #000000; font-weight: 700; font-size: 13px;">${nameDisplay}</span>
                            <span style="color: var(--accent-red); font-weight: 700; font-size: 11px;">${depStr}</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center;">
                        ${editBtnHtml}
                        ${deleteBtnHtml}
                    </div>
                `;
                
                const editBtn = personDiv.querySelector('.btn-edit-occupant');
                if (editBtn) {
                    editBtn.addEventListener('click', (e) => {
                        const idxToEdit = parseInt(e.currentTarget.dataset.idx);
                        const occupant = room.allocated[idxToEdit];
                        
                        document.getElementById('edit-occupant-room-num').value = roomNum;
                        document.getElementById('edit-occupant-idx').value = idxToEdit;
                        document.getElementById('edit-occupant-name').value = occupant.name || '';
                        document.getElementById('edit-occupant-subcat').value = occupant.subcategory || 'Mata';
                        document.getElementById('edit-occupant-centre').value = occupant.centre || '';
                        document.getElementById('edit-occupant-phone').value = occupant.phone || '';
                        document.getElementById('edit-occupant-dep-date').value = occupant.departureDate || '';
                        
                        document.getElementById('modal-edit-occupant').classList.add('active');
                    });
                }
                
                const deleteBtn = personDiv.querySelector('.btn-delete-occupant');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (e) => {
                        const idxToRemove = parseInt(e.currentTarget.dataset.idx);
                        const occupant = room.allocated[idxToRemove];
                        const displayName = occupant.name ? `${occupant.name} (${occupant.subcategory})` : `${occupant.subcategory} from ${occupant.centre || 'Unknown'}`;
                        
                        if (confirm(`Are you sure you want to remove ${displayName} from Room ${roomNum}?`)) {
                            // Remove from room.allocated
                            room.allocated.splice(idxToRemove, 1);
                            
                            // Recalculate occupancy beds (only adults)
                            const adults = room.allocated.filter(person => person.subcategory !== 'Children');
                            room.occupied = adults.length;

                            // Recalculate room gender
                            if (adults.length === 0) {
                                room.gender = null;
                            } else {
                                const hasFemale = adults.some(person => ['Mata', 'Kumari', 'Female', 'BK Teacher'].includes(person.subcategory));
                                const hasMale = adults.some(person => ['Adhar Kumar', 'Kumar', 'Male', 'Driver'].includes(person.subcategory));
                                if (hasFemale) room.gender = 'female';
                                else if (hasMale) room.gender = 'male';
                                else room.gender = null;
                            }

                            // Update UI
                            updateDashboardStats();
                            renderRoomMap('viz');
                            
                            // Refresh the modal occupants list
                            openMaintenanceModal(roomNum);
                        }
                    });
                }
                
                occupantsContainer.appendChild(personDiv);
            });
        }

        // Show modal
        document.getElementById('modal-maintenance').classList.add('active');
    }

    document.getElementById('btn-close-maint').addEventListener('click', () => {
        document.getElementById('modal-maintenance').classList.remove('active');
    });

    // Edit/Transfer Occupant Modal triggers
    document.getElementById('btn-close-edit-occupant').addEventListener('click', () => {
        document.getElementById('modal-edit-occupant').classList.remove('active');
    });

    document.getElementById('btn-save-edit-occupant').addEventListener('click', () => {
        const roomNum = document.getElementById('edit-occupant-room-num').value;
        const idx = parseInt(document.getElementById('edit-occupant-idx').value);
        const room = state.rooms[roomNum];
        if (!room || !room.allocated[idx]) return;

        const newName = document.getElementById('edit-occupant-name').value.trim();
        const newSubcat = document.getElementById('edit-occupant-subcat').value;
        const newCentre = document.getElementById('edit-occupant-centre').value.trim();
        const newPhone = document.getElementById('edit-occupant-phone').value.trim();
        const newDepDate = document.getElementById('edit-occupant-dep-date').value;

        // Update details
        room.allocated[idx].name = newName;
        room.allocated[idx].subcategory = newSubcat;
        room.allocated[idx].centre = newCentre;
        room.allocated[idx].phone = newPhone;
        room.allocated[idx].departureDate = newDepDate || null;

        // Recalculate room occupancy beds and gender
        const adults = room.allocated.filter(p => p.subcategory !== 'Children');
        room.occupied = adults.length;

        if (adults.length === 0) {
            room.gender = null;
        } else {
            const hasFemale = adults.some(p => ['Mata', 'Kumari', 'Female', 'BK Teacher'].includes(p.subcategory));
            const hasMale = adults.some(p => ['Adhar Kumar', 'Kumar', 'Male', 'Driver'].includes(p.subcategory));
            if (hasFemale) room.gender = 'female';
            else if (hasMale) room.gender = 'male';
            else room.gender = null;
        }

        saveState();
        document.getElementById('modal-edit-occupant').classList.remove('active');
        openMaintenanceModal(roomNum); // Refresh Room Details modal
        renderRoomMap('viz');
        updateDashboardStats();
        alert('Occupant information updated successfully.');
    });

    document.getElementById('btn-transfer-edit-occupant').addEventListener('click', () => {
        const roomNum = document.getElementById('edit-occupant-room-num').value;
        const idx = parseInt(document.getElementById('edit-occupant-idx').value);
        const room = state.rooms[roomNum];
        if (!room || !room.allocated[idx]) return;

        const occupant = room.allocated[idx];
        const displayName = occupant.name ? `${occupant.name} (${occupant.subcategory})` : occupant.subcategory;

        if (!confirm(`Are you sure you want to transfer ${displayName} out of Room ${roomNum}? \n\nThis will remove them from Room ${roomNum} and load their details on the Room Allotment screen to select a new room.`)) {
            return;
        }

        // Remove from current room
        room.allocated.splice(idx, 1);

        // Recalculate room occupancy beds and gender
        const adults = room.allocated.filter(p => p.subcategory !== 'Children');
        room.occupied = adults.length;

        if (adults.length === 0) {
            room.gender = null;
        } else {
            const hasFemale = adults.some(p => ['Mata', 'Kumari', 'Female', 'BK Teacher'].includes(p.subcategory));
            const hasMale = adults.some(p => ['Adhar Kumar', 'Kumar', 'Male', 'Driver'].includes(p.subcategory));
            if (hasFemale) room.gender = 'female';
            else if (hasMale) room.gender = 'male';
            else room.gender = null;
        }

        // Set up registration state with occupant details
        state.registration = {
            mode: 'individual',
            category: occupant.category || 'bk',
            type: occupant.type || 'guest',
            centreName: occupant.centre || '',
            centrePhone: occupant.phone || '',
            arrivalTime: occupant.arrivalTime || getCurrentFormattedDateTime(),
            departureDate: occupant.departureDate || null,
            counts: {
                mata: 0, kumari: 0, teacher: 0, children: 0, adhar_kumar: 0, kumar: 0,
                nbk_female: 0, nbk_male: 0, nbk_children: 0, nbk_driver: 0
            },
            individuals: [
                {
                    name: occupant.name || '',
                    age: occupant.age || '',
                    phone: occupant.phone || '',
                    type: occupant.subcategory
                }
            ],
            sevaAllocations: {}
        };

        // Initialize Allotment State counts
        setupAllotmentCounts();

        // Pre-select category checkbox
        state.allotment.selectedCategories = [occupant.subcategory];

        saveState();
        document.getElementById('modal-edit-occupant').classList.remove('active');
        document.getElementById('modal-maintenance').classList.remove('active');

        // Route to allotment screen
        navigateTo('screen-allotment');
        alert(`${displayName} has been transferred. Please select a room on the allotment page to place them.`);
    });

    document.getElementById('btn-save-maintenance').addEventListener('click', () => {
        if (!selectedMaintRoom) return;

        const isUnmaintained = document.getElementById('maint-checkbox').checked;
        const issue = document.getElementById('maint-issue-select').value;

        // If marked unmaintained but occupied beds exist, alert user
        const room = state.rooms[selectedMaintRoom];
        if (isUnmaintained && room.occupied > 0) {
            if (!confirm('This room currently has occupied beds. Marking it unmaintained will force color to red. Proceed?')) {
                return;
            }
        }

        room.unmaintained = isUnmaintained;
        room.maintenanceIssue = isUnmaintained ? issue : '';

        // Reset gender if unmaintained and empty
        if (isUnmaintained && room.occupied === 0) {
            room.gender = null;
        }

        document.getElementById('modal-maintenance').classList.remove('active');
        renderRoomMap('viz');
        updateDashboardStats();
    });

    // Action chooser trigger routing
    document.getElementById('btn-close-chooser').addEventListener('click', () => {
        document.getElementById('modal-action-chooser').classList.remove('active');
    });

    document.getElementById('btn-chooser-register').addEventListener('click', () => {
        document.getElementById('modal-action-chooser').classList.remove('active');
        // Pre-fill / reset form state
        resetRegistrationForm();
        navigateTo('screen-register');
    });

    document.getElementById('btn-chooser-report').addEventListener('click', () => {
        document.getElementById('modal-action-chooser').classList.remove('active');
        // Populate report view
        generateReportView();
        navigateTo('screen-report');
    });

    document.getElementById('btn-room-viz-shortcut').addEventListener('click', () => {
        navigateTo('screen-room-map');
    });

    document.getElementById('btn-go-room-viz').addEventListener('click', () => {
        navigateTo('screen-room-viz');
    });

    document.getElementById('btn-back-from-room-viz').addEventListener('click', () => {
        navigateTo('screen-home');
    });

    document.getElementById('btn-back-from-room-map').addEventListener('click', () => {
        navigateTo('screen-home');
    });

    // ----------------------------------------------------
    // REGISTRATION FORM LOGIC
    // ----------------------------------------------------
    function resetRegistrationForm() {
        document.getElementById('reg-centre-name').value = '';
        const phoneEl = document.getElementById('reg-centre-phone');
        if (phoneEl) phoneEl.value = '';
        const depDateEl = document.getElementById('reg-departure-date');
        if (depDateEl) depDateEl.value = '';
        state.registration.departureDate = null;
        state.registration.centreName = '';
        state.registration.centrePhone = '';
        state.registration.arrivalTime = '';
        state.registration.counts = {
            mata: 0, kumari: 0, teacher: 0, children: 0, adhar_kumar: 0, kumar: 0,
            nbk_female: 0, nbk_male: 0, nbk_children: 0, nbk_driver: 0
        };
        state.registration.individuals = [];
        state.registration.sevaAllocations = {};
        
        // Reset counters display
        updateCountersDisplay();
        renderIndividualRows();

        // Default segmented views
        setSegmentActive('toggle-group-individual', 'group');
        setSegmentActive('toggle-bk-nbk', 'bk');
        setSegmentActive('toggle-guest-sevadhari', 'guest');
        
        handleFormToggleVisibility();
    }

    function setSegmentActive(containerId, value) {
        const container = document.getElementById(containerId);
        container.querySelectorAll('.segment-btn').forEach(btn => {
            if (btn.dataset.value === value) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // Toggle segment controls
    setupSegmentClick('toggle-group-individual', (val) => {
        state.registration.mode = val;
        handleFormToggleVisibility();
    });

    setupSegmentClick('toggle-bk-nbk', (val) => {
        state.registration.category = val;
        // Reset type to guest to prevent mismatch
        state.registration.type = 'guest';
        setSegmentActive('toggle-guest-sevadhari', 'guest');
        
        // Dynamically update the second type option
        const typeContainer = document.getElementById('toggle-guest-sevadhari');
        const secondTypeBtn = typeContainer.querySelector('button:nth-child(2)');
        
        if (val === 'bk') {
            if (secondTypeBtn) {
                secondTypeBtn.dataset.value = 'sevadhari';
                secondTypeBtn.textContent = 'Sevadhari';
            }
        } else {
            if (secondTypeBtn) {
                secondTypeBtn.dataset.value = 'driver';
                secondTypeBtn.textContent = 'Driver/Worker';
            }
        }
        handleFormToggleVisibility();
    });

    setupSegmentClick('toggle-guest-sevadhari', (val) => {
        state.registration.type = val;
        handleFormToggleVisibility();
    });

    function setupSegmentClick(id, callback) {
        const container = document.getElementById(id);
        container.querySelectorAll('.segment-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                container.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                callback(e.currentTarget.dataset.value);
            });
        });
    }

    function handleFormToggleVisibility() {
        const mode = state.registration.mode;
        const category = state.registration.category;
        const type = state.registration.type;

        const groupInputs = document.getElementById('group-registration-inputs');
        const bkInputs = document.getElementById('group-bk-inputs');
        const nbkInputs = document.getElementById('group-nbk-inputs');
        const indivInputs = document.getElementById('individual-registration-inputs');
        
        // Mode Visibility
        if (mode === 'group') {
            groupInputs.classList.remove('hidden');
            indivInputs.classList.add('hidden');
            
            // BK vs NBK inputs
            if (category === 'bk') {
                bkInputs.classList.remove('hidden');
                nbkInputs.classList.add('hidden');
            } else {
                // Non-BK
                bkInputs.classList.add('hidden');
                nbkInputs.classList.remove('hidden');
                
                // If type is driver, show Driver row
                const driverRow = document.getElementById('row-nbk-driver');
                const femaleRow = document.getElementById('row-nbk-female');
                const maleRow = document.getElementById('row-nbk-male');
                const childrenRow = document.getElementById('row-nbk-children');
                
                if (type === 'driver') {
                    driverRow.classList.remove('hidden');
                    femaleRow.classList.add('hidden');
                    maleRow.classList.add('hidden');
                    childrenRow.classList.add('hidden');
                } else {
                    driverRow.classList.add('hidden');
                    femaleRow.classList.remove('hidden');
                    maleRow.classList.remove('hidden');
                    childrenRow.classList.remove('hidden');
                }
            }
        } else {
            // Individual Mode
            groupInputs.classList.add('hidden');
            indivInputs.classList.remove('hidden');
        }

        // BK Teacher visibility check: Mode is group, Category is BK, Type is Guest
        const rowTeacher = document.getElementById('row-bk-teacher');
        if (rowTeacher) {
            if (mode === 'group' && category === 'bk' && type === 'guest') {
                rowTeacher.classList.remove('hidden');
            } else {
                rowTeacher.classList.add('hidden');
                state.registration.counts.teacher = 0;
                updateCountersDisplay();
            }
        }
    }

    // Counters interaction (+ / - buttons)
    document.querySelectorAll('.counter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const isPlus = e.currentTarget.classList.contains('plus');
            const type = e.currentTarget.dataset.type;
            
            // Map counter key
            let key = '';
            if (type === 'mata') key = 'mata';
            else if (type === 'kumari') key = 'kumari';
            else if (type === 'teacher') key = 'teacher';
            else if (type === 'children') key = 'children';
            else if (type === 'adhar_kumar') key = 'adhar_kumar';
            else if (type === 'kumar') key = 'kumar';
            else if (type === 'nbk_female') key = 'nbk_female';
            else if (type === 'nbk_male') key = 'nbk_male';
            else if (type === 'nbk_children') key = 'nbk_children';
            else if (type === 'nbk_driver') key = 'nbk_driver';

            if (!key) return;

            let currentVal = state.registration.counts[key];
            if (isPlus) {
                state.registration.counts[key]++;
            } else {
                if (currentVal > 0) {
                    state.registration.counts[key]--;
                }
            }

            updateCountersDisplay();
        });
    });

    function updateCountersDisplay() {
        const counts = state.registration.counts;
        const updateVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = val;
                const parent = el.closest('.counter-controls');
                if (parent) {
                    if (val > 0) {
                        parent.classList.add('selected');
                    } else {
                        parent.classList.remove('selected');
                    }
                }
            }
        };
        updateVal('count-mata', counts.mata);
        updateVal('count-kumari', counts.kumari);
        updateVal('count-teacher', counts.teacher);
        updateVal('count-children', counts.children);
        updateVal('count-adhar_kumar', counts.adhar_kumar);
        updateVal('count-kumar', counts.kumar);
        
        updateVal('count-nbk-female', counts.nbk_female);
        updateVal('count-nbk-male', counts.nbk_male);
        updateVal('count-nbk-children', counts.nbk_children);
        updateVal('count-nbk-driver', counts.nbk_driver);
    }

    // Individual List Row Management
    document.getElementById('btn-add-indiv-row').addEventListener('click', () => {
        if (state.registration.individuals.length >= 10) {
            alert('Maximum 10 persons can be added.');
            return;
        }

        const newPerson = {
            id: 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            name: '',
            age: '',
            phone: '',
            type: 'Mata', // default
            centre: ''
        };

        state.registration.individuals.push(newPerson);
        renderIndividualRows();
    });

    function renderIndividualRows() {
        const container = document.getElementById('individual-list-container');
        container.innerHTML = '';
        
        document.getElementById('indiv-count').textContent = state.registration.individuals.length;

        state.registration.individuals.forEach((person, index) => {
            const row = document.createElement('div');
            row.className = 'indiv-row';
            
            // Types dropdown selection based on BK status
            const types = ['Mata', 'Kumari', 'Adhar Kumar', 'Kumar', 'Children', 'Driver', 'Male', 'Female'];
            let typeOptions = types.map(t => `<option value="${t}" ${person.type === t ? 'selected' : ''}>${t}</option>`).join('');

            row.innerHTML = `
                <button class="btn-remove-row" data-index="${index}">✕</button>
                <div class="form-group" style="margin-bottom: 8px;">
                    <input type="text" placeholder="Person ${index + 1} Name" class="form-input indiv-name" data-index="${index}" value="${person.name}">
                </div>
                <div class="indiv-fields-grid" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                    <input type="number" placeholder="Age" class="form-input indiv-age" data-index="${index}" value="${person.age}">
                    <input type="tel" placeholder="Phone" class="form-input indiv-phone" data-index="${index}" value="${person.phone || ''}">
                    <select class="indiv-select-type" data-index="${index}" style="font-size: 11px; padding: 8px;">
                        ${typeOptions}
                    </select>
                </div>
            `;

            // Wire input events to keep state sync
            row.querySelector('.indiv-name').addEventListener('input', (e) => {
                state.registration.individuals[index].name = e.target.value;
            });
            row.querySelector('.indiv-age').addEventListener('input', (e) => {
                state.registration.individuals[index].age = e.target.value;
            });
            row.querySelector('.indiv-phone').addEventListener('input', (e) => {
                state.registration.individuals[index].phone = e.target.value;
            });
            row.querySelector('.indiv-select-type').addEventListener('change', (e) => {
                state.registration.individuals[index].type = e.target.value;
            });
            row.querySelector('.btn-remove-row').addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index);
                state.registration.individuals.splice(idx, 1);
                renderIndividualRows();
            });

            container.appendChild(row);
        });
    }

    // ----------------------------------------------------
    // PROCEED FROM REGISTRATION TO ALLOTMENT / SEVA
    // ----------------------------------------------------
    document.getElementById('btn-proceed-allotment').addEventListener('click', () => {
        const centreInput = document.getElementById('reg-centre-name').value.trim();
        if (!centreInput) {
            alert('Please enter a Centre Name first.');
            return;
        }
        state.registration.centreName = centreInput;
        
        const phoneInput = document.getElementById('reg-centre-phone') ? document.getElementById('reg-centre-phone').value.trim() : '';
        state.registration.centrePhone = phoneInput;
        state.registration.arrivalTime = getCurrentFormattedDateTime();

        // Validate Departure Date for Monthly Sevadhari Programme
        if (state.selectedProgramme && state.selectedProgramme.type === 'monthly') {
            const depDate = document.getElementById('reg-departure-date').value;
            if (!depDate) {
                alert('Departure Date is mandatory for Monthly Sevadhari Programme.');
                return;
            }
            state.registration.departureDate = depDate;
        } else {
            state.registration.departureDate = null;
        }

        // Validate count
        let totalRegistered = 0;
        const mode = state.registration.mode;
        const category = state.registration.category;
        const type = state.registration.type;

        if (mode === 'group') {
            const counts = state.registration.counts;
            if (category === 'bk') {
                totalRegistered = counts.mata + counts.kumari + counts.children + counts.adhar_kumar + counts.kumar;
            } else {
                if (type === 'driver') {
                    totalRegistered = counts.nbk_driver;
                } else {
                    totalRegistered = counts.nbk_female + counts.nbk_male + counts.nbk_children;
                }
            }
        } else {
            // Individual mode
            totalRegistered = state.registration.individuals.length;
            // Validate all individuals have names
            let invalid = state.registration.individuals.some(p => !p.name.trim());
            if (invalid || totalRegistered === 0) {
                alert('Please enter names for all registered individuals (at least 1 required).');
                return;
            }
        }

        if (totalRegistered === 0) {
            alert('Please add at least 1 person to register.');
            return;
        }

        // Initialize Allotment State counts
        setupAllotmentCounts();

        // Route: if BK and Sevadhari, go to Ruhani Seva page first!
        if (category === 'bk' && type === 'sevadhari') {
            navigateTo('screen-seva');
        } else {
            navigateTo('screen-allotment');
        }
    });

    function setupAllotmentCounts() {
        const reg = state.registration;
        let counts = {};

        if (reg.mode === 'group') {
            if (reg.category === 'bk') {
                if (reg.counts.mata > 0) counts['Mata'] = reg.counts.mata;
                if (reg.counts.kumari > 0) counts['Kumari'] = reg.counts.kumari;
                if (reg.counts.teacher > 0) counts['BK Teacher'] = reg.counts.teacher;
                if (reg.counts.children > 0) counts['Children'] = reg.counts.children;
                if (reg.counts.adhar_kumar > 0) counts['Adhar Kumar'] = reg.counts.adhar_kumar;
                if (reg.counts.kumar > 0) counts['Kumar'] = reg.counts.kumar;
            } else {
                if (reg.type === 'driver') {
                    if (reg.counts.nbk_driver > 0) counts['Driver'] = reg.counts.nbk_driver;
                } else {
                    if (reg.counts.nbk_female > 0) counts['Female'] = reg.counts.nbk_female;
                    if (reg.counts.nbk_male > 0) counts['Male'] = reg.counts.nbk_male;
                    if (reg.counts.nbk_children > 0) counts['Children'] = reg.counts.nbk_children;
                }
            }
        } else {
            // Individual Mode
            reg.individuals.forEach(p => {
                const type = p.type; // Mata, Kumari etc.
                counts[type] = (counts[type] || 0) + 1;
            });
        }

        state.allotment.remainingToAllot = { ...counts };
        state.allotment.initialCounts = { ...counts };
        state.allotment.allottedLog = [];
        state.allotment.tempAllocations = [];
        state.allotment.selectedCategories = [];
        state.allotment.selectedRoomNum = null;
    }

    // ----------------------------------------------------
    // RUHANI SEVA PAGE LOGIC
    // ----------------------------------------------------
    function renderSevaPersonsList() {
        const container = document.getElementById('seva-persons-list-container');
        container.innerHTML = '';

        const reg = state.registration;
        let itemsList = [];

        if (reg.mode === 'group') {
            // Unpack category counts into individual checkable list items
            const categories = ['mata', 'kumari', 'children', 'adhar_kumar', 'kumar'];
            const labels = { mata: 'Mata', kumari: 'Kumari', children: 'Children', adhar_kumar: 'Adhar Kumar', kumar: 'Kumar' };
            
            categories.forEach(cat => {
                const count = reg.counts[cat];
                for (let i = 1; i <= count; i++) {
                    const id = `grp_${cat}_${i}`;
                    itemsList.push({
                        id: id,
                        name: `${labels[cat]} #${i}`,
                        category: labels[cat]
                    });
                }
            });
        } else {
            // Individual mode
            reg.individuals.forEach(p => {
                itemsList.push({
                    id: p.id,
                    name: `${p.name} (${p.type})`,
                    category: p.type
                });
            });
        }

        itemsList.forEach(item => {
            const assignedDept = reg.sevaAllocations[item.id];
            const badgeClass = assignedDept ? 'assigned' : '';
            const badgeText = assignedDept ? assignedDept.toUpperCase() : 'PENDING';
            
            const div = document.createElement('div');
            div.className = 'seva-person-item';
            div.innerHTML = `
                <label class="checkbox-container-label">
                    <input type="checkbox" class="chk-seva-select" data-id="${item.id}">
                    <span class="custom-checkbox"></span>
                    <span>${item.name}</span>
                </label>
                <span class="seva-badge ${badgeClass}">${badgeText}</span>
            `;
            container.appendChild(div);
        });
    }

    document.getElementById('btn-allot-seva-action').addEventListener('click', () => {
        const deptSelect = document.getElementById('seva-dept-select');
        const department = deptSelect.options[deptSelect.selectedIndex].text;
        
        const checkboxes = document.querySelectorAll('.chk-seva-select:checked');
        if (checkboxes.length === 0) {
            alert('Please select at least 1 person to allot seva.');
            return;
        }

        checkboxes.forEach(chk => {
            const id = chk.dataset.id;
            state.registration.sevaAllocations[id] = department;
        });

        renderSevaPersonsList();
    });

    document.getElementById('btn-proceed-from-seva-to-allotment').addEventListener('click', () => {
        navigateTo('screen-allotment');
    });

    // ----------------------------------------------------
    // ROOM ALLOTMENT SCREEN LOGIC
    // ----------------------------------------------------
    function renderAllotmentSummary() {
        const summaryContainer = document.getElementById('allotment-counts-summary-container');
        summaryContainer.innerHTML = '';

        const rem = state.allotment.remainingToAllot;
        const initial = state.allotment.initialCounts;

        Object.keys(initial).forEach(cat => {
            const remCount = rem[cat] || 0;
            const initCount = initial[cat];
            
            const div = document.createElement('div');
            if (remCount === 0) {
                div.className = 'summary-badge status-completed';
                div.innerHTML = `<span class="badge-checkmark">✓</span> ${cat}: ${initCount}`;
            } else {
                div.className = 'summary-badge status-pending';
                div.innerHTML = `${cat}: ${remCount}/${initCount} left`;
            }
            summaryContainer.appendChild(div);
        });

        // Render target category checkboxes
        const checkboxRow = document.getElementById('allotment-checkbox-row');
        checkboxRow.innerHTML = '';

        Object.keys(rem).forEach(cat => {
            const remCount = rem[cat] || 0;
            if (remCount > 0) {
                const label = document.createElement('label');
                const isChecked = state.allotment.selectedCategories.includes(cat);
                label.className = `gender-checkbox-card ${isChecked ? 'active-checked' : ''}`;
                label.innerHTML = `
                    <input type="checkbox" class="chk-allot-cat-select" data-cat="${cat}" ${isChecked ? 'checked' : ''} style="display:none;">
                    <span>${cat} (${remCount})</span>
                `;

                label.querySelector('input').addEventListener('change', (e) => {
                    const category = e.target.dataset.cat;
                    if (e.target.checked) {
                        state.allotment.selectedCategories.push(category);
                    } else {
                        state.allotment.selectedCategories = state.allotment.selectedCategories.filter(c => c !== category);
                    }
                    
                    // Enforce Gender Segregation at Checkbox level:
                    // If we select a female category (Mata, Kumari, Children, Female), we cannot select male categories (Adhar Kumar, Kumar, Male, Driver)
                    enforceGenderSelectionRules(category, e.target.checked);

                    renderAllotmentSummary();
                    resetTempAllocations();
                });

                checkboxRow.appendChild(label);
            }
        });
    }

    function enforceGenderSelectionRules(changedCat, isChecked) {
        if (!isChecked) return;

        // Children can be mixed with either gender, so ignore exclusions
        if (changedCat === 'Children') return;

        const femaleCategories = ['Mata', 'Kumari', 'Female', 'BK Teacher'];
        const maleCategories = ['Adhar Kumar', 'Kumar', 'Male', 'Driver'];

        const isFemale = femaleCategories.includes(changedCat);
        const oppositeList = isFemale ? maleCategories : femaleCategories;

        // Uncheck all opposite gender categories, leaving Children untouched
        state.allotment.selectedCategories = state.allotment.selectedCategories.filter(c => !oppositeList.includes(c));
    }

    function resetTempAllocations() {
        state.allotment.tempAllocations = [];
        state.allotment.selectedRoomNum = null;
        document.getElementById('allotment-room-info-panel').classList.add('hidden');
        renderRoomMap('allot');
        updateAllotmentButtons();
    }

    function selectRoomForAllotment(roomNum) {
        const room = state.rooms[roomNum];
        
        // 0. Validation: Cannot place in a Pantry room
        if (room.pantry) {
            alert('Pantry room cannot be allotted for accommodation.');
            return;
        }

        // Validation: Cannot place in a Src Niwasi room
        if (room.niwasi) {
            alert('Src Niwasi room cannot be allotted for accommodation.');
            return;
        }

        // 1. Validation: Cannot place in unmaintained room
        if (room.unmaintained) {
            alert('Room is unmaintained. Please select another room.');
            return;
        }

        // 2. Validation: Must select category checkboxes first
        const selectedCats = state.allotment.selectedCategories;
        if (selectedCats.length === 0) {
            alert('Please select which persons (categories) to allocate from the top summary checklist first.');
            return;
        }

        // Toggle/Deselect room if already temporarily allocated
        const existingTempIdx = state.allotment.tempAllocations.findIndex(t => t.roomNum === roomNum);
        if (existingTempIdx > -1) {
            state.allotment.tempAllocations.splice(existingTempIdx, 1);
            if (state.allotment.selectedRoomNum === roomNum) {
                if (state.allotment.tempAllocations.length > 0) {
                    state.allotment.selectedRoomNum = state.allotment.tempAllocations[state.allotment.tempAllocations.length - 1].roomNum;
                } else {
                    state.allotment.selectedRoomNum = null;
                }
            }
            
            renderRoomMap('allot');
            updateAllotmentButtons();
            
            const panel = document.getElementById('allotment-room-info-panel');
            if (state.allotment.selectedRoomNum) {
                const activeRoomNum = state.allotment.selectedRoomNum;
                const activeRoom = state.rooms[activeRoomNum];
                const activeTemp = state.allotment.tempAllocations.find(t => t.roomNum === activeRoomNum);
                
                document.getElementById('panel-room-number').textContent = activeRoomNum;
                document.getElementById('panel-available-beds').textContent = activeRoom.capacity - activeRoom.occupied;
                document.getElementById('panel-allocated-count').textContent = activeTemp ? `${activeTemp.adultCount} Adult(s), ${activeTemp.childCount} Child(ren)` : '0';
                
                let totalIncomingCount = selectedCats.reduce((sum, c) => sum + (state.allotment.remainingToAllot[c] || 0), 0);
                let totalPlaced = 0;
                state.allotment.tempAllocations.forEach(t => totalPlaced += (t.adultCount + t.childCount));
                let remToAllot = totalIncomingCount - totalPlaced;
                
                document.getElementById('panel-selected-count').textContent = totalIncomingCount;
                document.getElementById('panel-remaining-count').textContent = remToAllot;
            } else {
                panel.classList.add('hidden');
            }
            return;
        }

        // Check gender of adults in the checked categories (Children can go into any room)
        const hasFemaleAdult = selectedCats.some(c => ['Mata', 'Kumari', 'Female', 'BK Teacher'].includes(c));
        const hasMaleAdult = selectedCats.some(c => ['Adhar Kumar', 'Kumar', 'Male', 'Driver'].includes(c));

        // 3. Validation: Gender Segregation Rule
        if (room.occupied > 0 && room.gender) {
            if (room.gender === 'female' && hasMaleAdult) {
                alert(`Gender Conflict: This room is already occupied by females. Cannot place male adults here.`);
                return;
            }
            if (room.gender === 'male' && hasFemaleAdult) {
                alert(`Gender Conflict: This room is already occupied by males. Cannot place female adults here.`);
                return;
            }
        }

        // Check if there are adults in the selection
        const hasAdult = hasFemaleAdult || hasMaleAdult;

        // 4. Validation: Room Full Rule (Only if allocating adults. Children do not occupy beds.)
        if (hasAdult && room.occupied >= room.capacity) {
            alert(`This room is already full (${room.capacity}/${room.capacity}).`);
            return;
        }

        // Calculate allotment math for selected target
        // Separate adults and children
        const childCats = selectedCats.filter(c => c === 'Children');
        const adultCats = selectedCats.filter(c => c !== 'Children');

        let remainingChildren = childCats.reduce((sum, c) => sum + (state.allotment.remainingToAllot[c] || 0), 0);
        let remainingAdults = adultCats.reduce((sum, c) => sum + (state.allotment.remainingToAllot[c] || 0), 0);

        // Subtract what we already allotted in other temporary rooms in this click session
        let tempAdultsElsewhere = 0;
        let tempChildrenElsewhere = 0;
        state.allotment.tempAllocations.forEach(temp => {
            tempAdultsElsewhere += temp.adultCount || 0;
            tempChildrenElsewhere += temp.childCount || 0;
        });

        let adultsToPlace = remainingAdults - tempAdultsElsewhere;
        let childrenToPlace = remainingChildren - tempChildrenElsewhere;

        if (adultsToPlace <= 0 && childrenToPlace <= 0) {
            alert('All selected people are already temporarily placed. Click "Allocate" to finalize, or deselect a highlighted room to reallocate.');
            return;
        }

        // Beds available in this room
        let bedsAvailable = room.capacity - room.occupied;
        let adultsPlacedInRoom = Math.min(adultsToPlace, bedsAvailable);
        let childrenPlacedInRoom = childrenToPlace; // Children have no bed limit!

        state.allotment.selectedRoomNum = roomNum;

        // Update temporary allocation log for this room
        const tempAllot = {
            roomNum: roomNum,
            adultCount: adultsPlacedInRoom,
            childCount: childrenPlacedInRoom
        };

        state.allotment.tempAllocations.push(tempAllot);

        // Refresh lists
        renderRoomMap('allot');
        updateAllotmentButtons();

        // Render Info panel
        const panel = document.getElementById('allotment-room-info-panel');
        panel.classList.remove('hidden');
        document.getElementById('panel-room-number').textContent = roomNum;
        
        let totalIncomingCount = remainingAdults + remainingChildren;
        document.getElementById('panel-selected-count').textContent = totalIncomingCount;
        document.getElementById('panel-available-beds').textContent = bedsAvailable;
        document.getElementById('panel-allocated-count').textContent = `${adultsPlacedInRoom} Adult(s), ${childrenPlacedInRoom} Child(ren)`;

        // Calculate remaining
        let totalPlaced = 0;
        state.allotment.tempAllocations.forEach(t => totalPlaced += (t.adultCount + t.childCount));
        let remToAllot = totalIncomingCount - totalPlaced;
        document.getElementById('panel-remaining-count').textContent = remToAllot;
    }

    function updateAllotmentButtons() {
        const allocateBtn = document.getElementById('btn-allocate-room-action');
        const printBtn = document.getElementById('btn-print-report-trigger');

        // Check total incoming size vs temp allocations
        let totalIncomingCount = 0;
        state.allotment.selectedCategories.forEach(c => {
            totalIncomingCount += state.allotment.remainingToAllot[c] || 0;
        });

        let totalPlaced = 0;
        state.allotment.tempAllocations.forEach(t => totalPlaced += (t.adultCount + t.childCount));

        let remaining = totalIncomingCount - totalPlaced;

        // Activate "Allocate Room" button ONLY when remaining is 0 AND we actually placed someone
        if (totalIncomingCount > 0 && remaining === 0 && totalPlaced > 0) {
            allocateBtn.classList.remove('disabled');
            allocateBtn.disabled = false;
            allocateBtn.textContent = `Allocate ${totalPlaced} Person(s) Now`;
        } else {
            allocateBtn.classList.add('disabled');
            allocateBtn.disabled = true;
            allocateBtn.textContent = 'Allocate Room';
            if (totalIncomingCount > 0) {
                allocateBtn.textContent = `Place remaining ${remaining} person(s)`;
            }
        }

        // Activate "Print Report" button ONLY when all registered people are allotted rooms (all remainingToAllot keys are 0)
        let allAllotted = true;
        Object.values(state.allotment.remainingToAllot).forEach(val => {
            if (val > 0) allAllotted = false;
        });

        if (allAllotted && Object.keys(state.allotment.remainingToAllot).length > 0) {
            printBtn.classList.remove('disabled');
            printBtn.disabled = false;
        } else {
            printBtn.classList.add('disabled');
            printBtn.disabled = true;
        }
    }

    // Allocate Room Action
    document.getElementById('btn-allocate-room-action').addEventListener('click', () => {
        const selectedCats = state.allotment.selectedCategories;
        const hasFemaleAdult = selectedCats.some(c => ['Mata', 'Kumari', 'Female', 'BK Teacher'].includes(c));
        const hasMaleAdult = selectedCats.some(c => ['Adhar Kumar', 'Kumar', 'Male', 'Driver'].includes(c));

        // 1. Commit tempAllocations to rooms state
        state.allotment.tempAllocations.forEach(temp => {
            const room = state.rooms[temp.roomNum];
            // Only increase occupied beds by adult count! Children do not occupy beds/seats!
            room.occupied += temp.adultCount;
            
            // Set room gender
            if (hasFemaleAdult) {
                room.gender = 'female';
            } else if (hasMaleAdult) {
                room.gender = 'male';
            } else {
                // If only Children were added, keep existing gender or leave it null (neutral)
                if (!room.gender) {
                    room.gender = null;
                }
            }

            // Distribute category counts to room allocation logs
            // We deplete from selectedCategories order
            let adultsToPlace = temp.adultCount;
            let childrenToPlace = temp.childCount;

            selectedCats.forEach(cat => {
                let isChild = (cat === 'Children');
                let countToPlace = isChild ? childrenToPlace : adultsToPlace;
                if (countToPlace <= 0) return;
                
                let remInCat = state.allotment.remainingToAllot[cat];
                let taken = Math.min(countToPlace, remInCat);
                
                if (taken > 0) {
                    // Log allotment
                    state.allotment.allottedLog.push({
                        category: cat,
                        count: taken,
                        room: temp.roomNum
                    });

                    // Add people to room list for visualization info
                    for (let i = 0; i < taken; i++) {
                        let nameVal = null;
                        let idVal = null;
                        let phoneVal = null;
                        if (state.registration.mode === 'individual') {
                            const unallocated = state.registration.individuals.filter(indiv => 
                                indiv.type === cat && !Object.values(state.rooms).some(r => r.allocated.some(occ => occ.id === indiv.id))
                            );
                            if (unallocated.length > 0) {
                                idVal = unallocated[0].id;
                                nameVal = unallocated[0].name;
                                phoneVal = unallocated[0].phone || '';
                            }
                        } else {
                            // Group mode - assign matching ID to link to seva if sevadhari
                            const catKeyMap = {
                                'Mata': 'mata',
                                'Kumari': 'kumari',
                                'BK Teacher': 'teacher',
                                'Children': 'children',
                                'Adhar Kumar': 'adhar_kumar',
                                'Kumar': 'kumar',
                                'Female': 'nbk_female',
                                'Male': 'nbk_male',
                                'Driver': 'nbk_driver'
                            };
                            const catKey = catKeyMap[cat];
                            if (catKey) {
                                const initialCount = state.allotment.initialCounts[cat] || 0;
                                const remainingCount = state.allotment.remainingToAllot[cat] || 0;
                                const alreadyAllotted = initialCount - remainingCount;
                                idVal = `grp_${catKey}_${alreadyAllotted + i + 1}`;
                            }
                            phoneVal = state.registration.centrePhone || '';
                        }
                        room.allocated.push({
                            id: idVal,
                            name: nameVal,
                            phone: phoneVal,
                            category: state.registration.category,
                            type: state.registration.type === 'guest' && cat === 'Driver' ? 'driver' : state.registration.type,
                            subcategory: cat,
                            centre: state.registration.centreName,
                            departureDate: state.registration.departureDate || null,
                            arrivalTime: state.registration.arrivalTime || getCurrentFormattedDateTime()
                        });
                    }

                    // Decrement remaining to allot
                    state.allotment.remainingToAllot[cat] -= taken;
                    if (isChild) {
                        childrenToPlace -= taken;
                    } else {
                        adultsToPlace -= taken;
                    }
                }
            });
        });

        // 2. Reset Selection and Temporary lists
        state.allotment.selectedCategories = [];
        state.allotment.tempAllocations = [];
        state.allotment.selectedRoomNum = null;
        document.getElementById('allotment-room-info-panel').classList.add('hidden');

        // 3. Re-render View
        renderAllotmentSummary();
        renderRoomMap('allot');
        updateAllotmentButtons();
        updateDashboardStats();

        // Auto-navigate to Report when all registered occupants are allotted rooms
        let allAllotted = true;
        Object.values(state.allotment.remainingToAllot).forEach(val => {
            if (val > 0) allAllotted = false;
        });
        if (allAllotted && Object.keys(state.allotment.remainingToAllot).length > 0) {
            generateReportView();
            navigateTo('screen-report');
        }
    });

    // ----------------------------------------------------
    // PRINT REPORT SCREEN LOGIC
    // ----------------------------------------------------
    document.getElementById('btn-print-report-trigger').addEventListener('click', () => {
        generateReportView();
        navigateTo('screen-report');
    });

    function generateReportView(isPast = false, pastProg = null) {
        // Meta details
        let progName, centre, date, allottedLog, sevaAllocations, arrivalTime;
        
        if (isPast && pastProg) {
            progName = pastProg.name;
            centre = pastProg.centreName || '-';
            date = pastProg.finishDate || '-';
            allottedLog = pastProg.allottedLog || [];
            sevaAllocations = pastProg.sevaAllocations || {};
            arrivalTime = pastProg.arrivalTime || '-';
        } else {
            progName = state.selectedProgramme ? state.selectedProgramme.name : '-';
            centre = state.registration.centreName || '-';
            date = new Date().toLocaleDateString('en-IN');
            allottedLog = state.allotment.allottedLog || [];
            sevaAllocations = state.registration.sevaAllocations || {};
            arrivalTime = state.registration.arrivalTime || getCurrentFormattedDateTime();
        }

        document.getElementById('report-prog-name').textContent = progName;
        if (document.getElementById('report-big-centre')) {
            document.getElementById('report-big-centre').textContent = centre;
        }
        if (document.getElementById('report-big-arrival')) {
            document.getElementById('report-big-arrival').innerHTML = `🕒 Arrival: <strong>${arrivalTime}</strong>`;
        }
        document.getElementById('report-date').textContent = date;

        // Calculate occupant statistics for the report summary
        let totalCount = 0;
        let guestCount = 0;
        let sevaCount = 0;
        let nbkCount = 0;

        const allocatedArray = [];
        if (isPast && pastProg) {
            const snapshot = pastProg.roomsSnapshot || {};
            Object.keys(snapshot).forEach(roomNum => {
                const occupants = snapshot[roomNum] || [];
                occupants.forEach(p => {
                    allocatedArray.push({ ...p, roomNum: roomNum });
                });
            });
        } else {
            Object.keys(state.rooms).forEach(roomNum => {
                const occupants = state.rooms[roomNum].allocated || [];
                occupants.forEach(p => {
                    allocatedArray.push({ ...p, roomNum: roomNum });
                });
            });
        }

        // Compute counts
        allocatedArray.forEach(p => {
            const cat = p.category;
            const type = p.type;

            if (cat === 'bk') {
                if (type === 'guest') guestCount++;
                else if (type === 'sevadhari') sevaCount++;
            } else {
                nbkCount++;
                if (type === 'driver') guestCount++; // Non-BK driver counts as guest
            }
        });
        totalCount = guestCount + sevaCount + nbkCount;

        // Populate report summary cards
        document.getElementById('report-stat-total-people').textContent = totalCount;
        document.getElementById('report-stat-total-guests').textContent = guestCount;
        document.getElementById('report-stat-total-sevadharis').textContent = sevaCount;
        document.getElementById('report-stat-total-nbks').textContent = nbkCount;

        // Set the report context state
        state.showingReportIsPast = isPast;
        state.showingReportPastProg = pastProg;

        // Room allotments lists formatting: Mata(5)=301
        // Let's group allotments by category
        let grouped = {};
        allottedLog.forEach(log => {
            if (!grouped[log.category]) grouped[log.category] = {};
            grouped[log.category][log.room] = (grouped[log.category][log.room] || 0) + log.count;
        });

        const listContainer = document.getElementById('report-room-allotments-list');
        listContainer.innerHTML = '';

        Object.keys(grouped).forEach(cat => {
            Object.keys(grouped[cat]).forEach(room => {
                const count = grouped[cat][room];
                const row = document.createElement('div');
                row.className = 'report-row';
                row.innerHTML = `
                    <span class="label">${cat} (${count})</span>
                    <span class="value">Room ${room}</span>
                `;
                listContainer.appendChild(row);
            });
        });

        if (allottedLog.length === 0) {
            listContainer.innerHTML = '<p style="text-align:center; color:#64748b;">No allocations recorded yet.</p>';
        }

        // Seva Duty Sheet
        const sevaSection = document.getElementById('report-seva-section');
        const sevaList = document.getElementById('report-seva-duty-list');
        sevaList.innerHTML = '';

        if (Object.keys(sevaAllocations).length > 0) {
            sevaSection.classList.add('hidden'); // Force hide as requested
            
            let namesMap = {};
            if (isPast && pastProg) {
                namesMap = pastProg.resolvedNamesMap || {};
            } else {
                const reg = state.registration;
                if (reg.mode === 'group') {
                    const categories = ['mata', 'kumari', 'teacher', 'children', 'adhar_kumar', 'kumar'];
                    const labels = { mata: 'Mata', kumari: 'Kumari', teacher: 'BK Teacher', children: 'Children', adhar_kumar: 'Adhar Kumar', kumar: 'Kumar' };
                    categories.forEach(cat => {
                        const count = reg.counts[cat];
                        for (let i = 1; i <= count; i++) {
                            namesMap[`grp_${cat}_${i}`] = `${labels[cat]} #${i}`;
                        }
                    });
                } else {
                    reg.individuals.forEach(p => {
                        namesMap[p.id] = p.name;
                    });
                }
            }

            Object.keys(sevaAllocations).forEach(id => {
                const row = document.createElement('div');
                row.className = 'report-row';
                row.innerHTML = `
                    <span class="label">${namesMap[id] || 'Sevadhari'}</span>
                    <span class="value">${sevaAllocations[id]}</span>
                `;
                sevaList.appendChild(row);
            });
        } else {
            sevaSection.classList.add('hidden');
        }

        // Centre-Wise Summary Generator
        let centreStats = {};
        
        if (isPast && pastProg) {
            // For past programmes, build from allottedLog snapshots
            allottedLog.forEach(log => {
                let centre = pastProg.centreName || 'Unknown';
                let sub = log.category; // e.g. 'Mata'
                
                // Determine if BK or NBK
                let isBk = ['Mata', 'Kumari', 'BK Teacher', 'Children', 'Adhar Kumar', 'Kumar'].includes(sub);
                let cat = isBk ? 'bk' : 'nbk';
                
                // Determine type
                let type = 'guest';
                if (isBk && Object.keys(sevaAllocations).length > 0) {
                    type = 'sevadhari';
                }
                if (sub === 'Driver') {
                    cat = 'nbk';
                    type = 'driver';
                }

                if (!centreStats[centre]) {
                    centreStats[centre] = {
                        bk_guest: { total: 0, sub: {} },
                        bk_sevadhari: { total: 0, sub: {} },
                        nbk: { total: 0, sub: {} }
                    };
                }

                let section = 'bk_guest';
                if (cat === 'nbk') {
                    section = 'nbk';
                } else if (type === 'sevadhari') {
                    section = 'bk_sevadhari';
                }

                centreStats[centre][section].total += log.count;
                centreStats[centre][section].sub[sub] = (centreStats[centre][section].sub[sub] || 0) + log.count;
            });
        } else {
            // Active rooms source
            Object.values(state.rooms).forEach(room => {
                room.allocated.forEach(p => {
                    let centre = p.centre || 'Unknown';
                    let cat = p.category; // 'bk' | 'nbk'
                    let type = p.type; // 'guest' | 'sevadhari' | 'driver'
                    let sub = p.subcategory; // 'Mata', 'Kumari' etc.

                    if (!centreStats[centre]) {
                        centreStats[centre] = {
                            bk_guest: { total: 0, sub: {} },
                            bk_sevadhari: { total: 0, sub: {} },
                            nbk: { total: 0, sub: {} }
                        };
                    }

                    let section = 'bk_guest';
                    if (cat === 'nbk') {
                        section = 'nbk';
                    } else if (type === 'sevadhari') {
                        section = 'bk_sevadhari';
                    }

                    centreStats[centre][section].total++;
                    centreStats[centre][section].sub[sub] = (centreStats[centre][section].sub[sub] || 0) + 1;
                });
            });
        }

        const centreListContainer = document.getElementById('report-centre-summary-list');
        centreListContainer.innerHTML = '';

        let centreKeys = Object.keys(centreStats);
        if (centreKeys.length === 0) {
            centreListContainer.innerHTML = '<p style="text-align:center; color:#64748b;">No centre statistics available.</p>';
        } else {
            centreKeys.forEach(centre => {
                const block = document.createElement('div');
                block.className = 'centre-summary-block';
                block.style.marginBottom = '12px';
                
                let html = `<h4>${centre}</h4>`;
                const data = centreStats[centre];
                
                // BK Guest
                if (data.bk_guest.total > 0) {
                    let subDetails = [];
                    Object.keys(data.bk_guest.sub).forEach(s => {
                        subDetails.push(`${s}: ${data.bk_guest.sub[s]}`);
                    });
                    html += `
                        <div class="centre-category-row">
                            <span class="centre-category-title">BK Guests (${data.bk_guest.total})</span>
                            <span class="centre-category-details">${subDetails.join(', ')}</span>
                        </div>
                    `;
                }

                // BK Sevadhari
                if (data.bk_sevadhari.total > 0) {
                    let subDetails = [];
                    Object.keys(data.bk_sevadhari.sub).forEach(s => {
                        subDetails.push(`${s}: ${data.bk_sevadhari.sub[s]}`);
                    });
                    html += `
                        <div class="centre-category-row">
                            <span class="centre-category-title">BK Sevadharis (${data.bk_sevadhari.total})</span>
                            <span class="centre-category-details">${subDetails.join(', ')}</span>
                        </div>
                    `;
                }

                // NBK
                if (data.nbk.total > 0) {
                    let subDetails = [];
                    Object.keys(data.nbk.sub).forEach(s => {
                        subDetails.push(`${s}: ${data.nbk.sub[s]}`);
                    });
                    html += `
                        <div class="centre-category-row">
                            <span class="centre-category-title">Non-BK Participants (${data.nbk.total})</span>
                            <span class="centre-category-details">${subDetails.join(', ')}</span>
                        </div>
                    `;
                }

                block.innerHTML = html;
                centreListContainer.appendChild(block);
            });
        }
    }

    // Trigger Native Window Print
    document.getElementById('btn-print-action').addEventListener('click', () => {
        window.print();
    });

    // WhatsApp Share button
    document.getElementById('btn-whatsapp-share').addEventListener('click', () => {
        const progName = state.selectedProgramme ? state.selectedProgramme.name : '-';
        const centre = state.registration.centreName || '-';
        const date = new Date().toLocaleDateString('en-IN');

        let text = `*ACCOMMODATION ALLOTMENT REPORT*\n`;
        text += `*Programme:* ${progName}\n`;
        text += `*Centre:* ${centre}\n`;
        text += `*Date:* ${date}\n\n`;
        text += `*Room Allotments:*\n`;

        let grouped = {};
        state.allotment.allottedLog.forEach(log => {
            if (!grouped[log.category]) grouped[log.category] = {};
            grouped[log.category][log.room] = (grouped[log.category][log.room] || 0) + log.count;
        });

        Object.keys(grouped).forEach(cat => {
            Object.keys(grouped[cat]).forEach(room => {
                const count = grouped[cat][room];
                text += `• ${cat}(${count}) = Room ${room}\n`;
            });
        });

        // Add Seva info if present
        const reg = state.registration;
        const sevaAllocations = reg.sevaAllocations;
        if (reg.category === 'bk' && reg.type === 'sevadhari' && Object.keys(sevaAllocations).length > 0) {
            text += `\n*Ruhani Seva Duties:*\n`;
            let namesMap = {};
            if (reg.mode === 'group') {
                const categories = ['mata', 'kumari', 'children', 'adhar_kumar', 'kumar'];
                const labels = { mata: 'Mata', kumari: 'Kumari', children: 'Children', adhar_kumar: 'Adhar Kumar', kumar: 'Kumar' };
                categories.forEach(cat => {
                    const count = reg.counts[cat];
                    for (let i = 1; i <= count; i++) {
                        namesMap[`grp_${cat}_${i}`] = `${labels[cat]} #${i}`;
                    }
                });
            } else {
                reg.individuals.forEach(p => {
                    namesMap[p.id] = p.name;
                });
            }

            Object.keys(sevaAllocations).forEach(id => {
                text += `• ${namesMap[id] || 'Sevadhari'}: ${sevaAllocations[id]}\n`;
            });
        }

        text += `\n_Generated via Accommodation SRC App_`;

        // Send via WhatsApp API to the registered contact phone number if present
        const phoneNum = state.registration.centrePhone || '';
        let cleanedPhone = phoneNum.replace(/\D/g, '');
        if (cleanedPhone.length === 10) {
            cleanedPhone = '91' + cleanedPhone;
        }

        let url = '';
        if (cleanedPhone) {
            url = `https://api.whatsapp.com/send?phone=${cleanedPhone}&text=${encodeURIComponent(text)}`;
        } else {
            url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
        }
        window.open(url, '_blank');
    });

    // ----------------------------------------------------
    // BACK BUTTON NAVIGATIONS
    // ----------------------------------------------------
    // ----------------------------------------------------
    // CENTRE-WISE OCCUPANT LIST & POPUP DETAILS
    function renderCentreWiseList() {
        const container = document.getElementById('centre-wise-list-container');
        if (!container) return;
        container.innerHTML = '';

        // Aggregate data by centre
        let centresData = {}; // { 'Delhi': { name, total, guest, sevadhari, nbk, details: [], arrivalTimes: Set } }

        Object.values(state.rooms).forEach(room => {
            room.allocated.forEach(person => {
                const centreName = person.centre || 'Unknown';
                if (!centresData[centreName]) {
                    centresData[centreName] = {
                        name: centreName,
                        total: 0,
                        guest: 0,
                        sevadhari: 0,
                        nbk: 0,
                        details: [],
                        arrivalTimes: new Set()
                    };
                }

                const data = centresData[centreName];
                data.total++;
                
                if (person.category === 'bk') {
                    if (person.type === 'sevadhari') {
                        data.sevadhari++;
                    } else {
                        data.guest++;
                    }
                } else {
                    data.nbk++;
                }

                if (person.arrivalTime) {
                    data.arrivalTimes.add(person.arrivalTime);
                }

                data.details.push({
                    subcategory: person.subcategory,
                    room: room.number,
                    arrivalTime: person.arrivalTime || ''
                });
            });
        });

        // Sort centres by total count in descending order
        const sortedCentres = Object.values(centresData).sort((a, b) => b.total - a.total);

        if (sortedCentres.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#64748b; font-size:14px; padding:30px 0;">No checked-in participants found.</p>';
            return;
        }

        sortedCentres.forEach(c => {
            const card = document.createElement('div');
            card.className = 'programme-card';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.alignItems = 'flex-start';
            card.style.gap = '8px';
            card.style.padding = '14px 16px';
            card.style.cursor = 'pointer';

            const arrivalTimesStr = Array.from(c.arrivalTimes).join(' | ');

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                    <h3 style="font-size:16px; font-weight:700; color:var(--text-primary); margin:0;">${c.name}</h3>
                    <span class="prog-badge regular" style="font-size:11px; padding:4px 10px; background:#4f46e5; color:#fff;">Total: ${c.total}</span>
                </div>
                <div style="display:flex; gap:12px; font-size:12px; color:var(--text-secondary); margin-top:2px;">
                    <span>👥 BK Guests: <strong>${c.guest}</strong></span>
                    <span>🛠️ Sevadharis: <strong>${c.sevadhari}</strong></span>
                    <span>👤 Non-BK: <strong>${c.nbk}</strong></span>
                </div>
                <div style="font-size:11px; color:var(--text-muted); margin-top:4px; display:flex; align-items:center; gap:4px;">
                    <span>🕒 Arrived:</span>
                    <strong>${arrivalTimesStr || 'Unknown'}</strong>
                </div>
            `;

            card.addEventListener('click', () => {
                openCentreDetailsModal(c);
            });

            container.appendChild(card);
        });
    }

    function openCentreDetailsModal(centre) {
        const modal = document.getElementById('modal-centre-details');
        const nameEl = document.getElementById('modal-centre-name');
        const listEl = document.getElementById('modal-centre-occupants-list');

        if (!modal || !nameEl || !listEl) return;

        nameEl.textContent = centre.name;
        listEl.innerHTML = '';

        // Group details by subcategory and then by room and arrival time:
        let grouped = {};

        centre.details.forEach(item => {
            const sub = item.subcategory || 'Other';
            const room = item.room || 'Unassigned';
            const time = item.arrivalTime || 'Unknown';
            const key = `${room}_${time}`;
            
            if (!grouped[sub]) {
                grouped[sub] = {};
            }
            if (!grouped[sub][key]) {
                grouped[sub][key] = { count: 0, room: room, arrivalTime: time };
            }
            grouped[sub][key].count++;
        });

        // Order of subcategories
        const subcategoryOrder = ['Mata', 'Kumari', 'Children', 'Kumar', 'Adhar Kumar', 'Female', 'Male', 'Driver'];
        let keys = Object.keys(grouped);
        keys.sort((a, b) => {
            let idxA = subcategoryOrder.indexOf(a);
            let idxB = subcategoryOrder.indexOf(b);
            if (idxA === -1) idxA = 999;
            if (idxB === -1) idxB = 999;
            return idxA - idxB;
        });

        if (keys.length === 0) {
            listEl.innerHTML = '<div style="color:#64748b; font-style:italic; text-align:center;">No details found.</div>';
        } else {
            keys.forEach(sub => {
                let roomParts = [];
                Object.values(grouped[sub]).forEach(info => {
                    roomParts.push(`${info.count} (Room ${info.room}) [🕒 ${info.arrivalTime}]`);
                });

                const row = document.createElement('div');
                row.style.padding = '8px 0';
                row.style.borderBottom = '1px solid rgba(15, 23, 42, 0.05)';
                row.style.display = 'flex';
                row.style.flexDirection = 'column';
                row.style.gap = '2px';
                row.style.fontSize = '14px';

                row.innerHTML = `
                    <strong style="color:var(--text-primary); font-weight:600;">${sub}:</strong>
                    <span style="color:var(--text-secondary); font-family:monospace; font-weight:600; font-size:12px; margin-left:8px;">${roomParts.join(', ')}</span>
                `;
                listEl.appendChild(row);
            });
        }

        modal.classList.add('active');
    }

    // Modal Close listener
    const closeCentreDetailsBtn = document.getElementById('btn-close-centre-details');
    if (closeCentreDetailsBtn) {
        closeCentreDetailsBtn.addEventListener('click', () => {
            document.getElementById('modal-centre-details').classList.remove('active');
        });
    }

    document.getElementById('btn-back-from-register').addEventListener('click', () => {
        navigateTo('screen-home');
    });

    document.getElementById('btn-back-from-seva').addEventListener('click', () => {
        navigateTo('screen-register');
    });

    document.getElementById('btn-back-from-allotment').addEventListener('click', () => {
        // If Sevadhari, go back to Seva screen, else back to Register
        if (state.registration.category === 'bk' && state.registration.type === 'sevadhari') {
            navigateTo('screen-seva');
        } else {
            navigateTo('screen-register');
        }
    });

    document.getElementById('btn-back-from-report').addEventListener('click', () => {
        navigateTo('screen-home');
    });

    document.getElementById('btn-home-from-report-header').addEventListener('click', () => {
        navigateTo('screen-home');
    });

    document.getElementById('btn-home-from-report-body').addEventListener('click', () => {
        navigateTo('screen-home');
    });

    // Clicking the logo on any screen navigates back to the home screen
    document.querySelectorAll('.clickable-logo').forEach(logo => {
        logo.addEventListener('click', () => {
            navigateTo('screen-home');
        });
    });

    // Wire up Sevadhari Details navigation
    document.getElementById('btn-go-sevadhari-details').addEventListener('click', () => {
        navigateTo('screen-sevadhari-details');
    });

    document.getElementById('btn-back-from-sevadhari-details').addEventListener('click', () => {
        navigateTo('screen-home');
    });

    // Hook navigation for Sevadhari Details
    const originalNavigateTo = navigateTo;
    navigateTo = function(screenId) {
        originalNavigateTo(screenId);
        if (screenId === 'screen-sevadhari-details') {
            activeSevaViewMode = 'centre';
            const centreView = document.getElementById('seva-details-centre-view');
            const deptView = document.getElementById('seva-details-dept-view');
            centreView.classList.remove('hidden');
            deptView.classList.add('hidden');
            
            // Set tab buttons active state
            document.querySelectorAll('#toggle-seva-view-mode .segment-btn').forEach(btn => {
                if (btn.dataset.value === 'centre') btn.classList.add('active');
                else btn.classList.remove('active');
            });
            
            renderSevadhariDetails();
        }
    };

    // Helper functions for Sevadhari Details & Date/Time
    function getCurrentFormattedDateTime() {
        const now = new Date();
        const day = now.getDate();
        const year = now.getFullYear();
        
        const monthNames = [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
        ];
        const monthName = monthNames[now.getMonth()];
        
        let hours = now.getHours();
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const hoursStr = hours.toString().padStart(2, '0');
        
        return `${day} ${monthName} ${year}, ${hoursStr}:${minutes} ${ampm}`;
    }

    let activeSevaViewMode = 'centre'; // 'centre' | 'dept'

    // Wire up tab buttons for Sevadhari Details view mode
    document.querySelectorAll('#toggle-seva-view-mode .segment-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#toggle-seva-view-mode .segment-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            activeSevaViewMode = e.currentTarget.dataset.value;
            
            const centreView = document.getElementById('seva-details-centre-view');
            const deptView = document.getElementById('seva-details-dept-view');
            if (activeSevaViewMode === 'centre') {
                centreView.classList.remove('hidden');
                deptView.classList.add('hidden');
                renderSevadhariDetails();
            } else {
                centreView.classList.add('hidden');
                deptView.classList.remove('hidden');
                renderDeptWiseList();
            }
        });
    });

    function getOccupantDisplayName(p) {
        if (p.name) return p.name;
        if (p.id && p.id.startsWith('grp_')) {
            const parts = p.id.split('_');
            const num = parts[parts.length - 1];
            return `${p.subcategory} #${num}`;
        }
        return p.subcategory;
    }

    function renderSevadhariDetails() {
        const unallocatedContainer = document.getElementById('seva-unallocated-container');
        const allocatedContainer = document.getElementById('seva-allocated-container');
        if (!unallocatedContainer || !allocatedContainer) return;

        unallocatedContainer.innerHTML = '';
        allocatedContainer.innerHTML = '';

        // Query all rooms and find sevadharis
        let unallocatedMap = {}; // { centreName: [occupants] }
        let allocatedMap = {};   // { centreName: [occupants] }

        Object.values(state.rooms).forEach(room => {
            room.allocated.forEach(p => {
                if (p.type !== 'sevadhari') return;
                
                const duty = state.registration.sevaAllocations[p.id];
                const centreName = p.centre || 'Unknown';
                
                if (!duty) {
                    // Unallocated
                    if (!unallocatedMap[centreName]) unallocatedMap[centreName] = [];
                    unallocatedMap[centreName].push({ occupant: p, roomNum: room.number });
                } else {
                    // Allocated
                    if (!allocatedMap[centreName]) allocatedMap[centreName] = [];
                    allocatedMap[centreName].push({ occupant: p, roomNum: room.number, duty: duty });
                }
            });
        });

        // 1. Render Unallocated list
        const unallocatedCentres = Object.keys(unallocatedMap);
        if (unallocatedCentres.length === 0) {
            unallocatedContainer.innerHTML = '<div style="color: #64748b; font-style: italic; text-align: center; padding: 16px; font-size: 13px;">All checked-in Sevadharis have duties assigned!</div>';
        } else {
            unallocatedCentres.forEach(centre => {
                const box = document.createElement('div');
                box.className = 'box-container';
                box.style.borderLeft = '4px solid var(--accent-red)';
                box.style.cursor = 'pointer';
                box.style.padding = '12px 16px';
                
                let html = `<h3 class="box-title" style="margin-bottom: 8px; font-size: 14px; font-weight: 700; color: var(--text-primary);">${centre}</h3>`;
                
                unallocatedMap[centre].forEach((item, idx) => {
                    const p = item.occupant;
                    const nameDisp = getOccupantDisplayName(p);
                    html += `
                        <div style="font-size: 13px; color: var(--text-secondary); display: flex; justify-content: space-between; padding: 6px 0; ${idx > 0 ? 'border-top: 1px solid rgba(15, 23, 42, 0.04);' : ''}">
                            <strong style="color: #000000; font-weight: 600;">${nameDisp}</strong>
                            <span style="color: var(--text-muted); font-size: 12px;">Room ${item.roomNum}</span>
                        </div>
                    `;
                });

                box.innerHTML = html;
                box.addEventListener('click', () => {
                    // Navigate to Ruhani Seva page
                    navigateTo('screen-seva');
                });
                unallocatedContainer.appendChild(box);
            });
        }

        // 2. Render Allocated list
        const allocatedCentres = Object.keys(allocatedMap);
        if (allocatedCentres.length === 0) {
            allocatedContainer.innerHTML = '<div style="color: #64748b; font-style: italic; text-align: center; padding: 16px; font-size: 13px;">No Sevadharis have been assigned Seva duty yet.</div>';
        } else {
            allocatedCentres.forEach(centre => {
                const box = document.createElement('div');
                box.className = 'box-container';
                box.style.borderLeft = '4px solid #10b981'; // Green border
                box.style.padding = '12px 16px';
                
                let html = `<h3 class="box-title" style="margin-bottom: 8px; font-size: 14px; font-weight: 700; color: var(--text-primary);">${centre}</h3>`;
                
                allocatedMap[centre].forEach((item, idx) => {
                    const p = item.occupant;
                    const nameDisp = getOccupantDisplayName(p);
                    
                    // Format departure date: custom or fallback to programme end date
                    const depDateVal = p.departureDate || (state.selectedProgramme ? state.selectedProgramme.endDate : null);
                    const formattedDepDate = depDateVal ? formatDateToDDMonthYear(depDateVal) : 'N/A';
                    
                    html += `
                        <div style="font-size: 13px; color: var(--text-secondary); display: flex; flex-direction: column; padding: 8px 0; ${idx > 0 ? 'border-top: 1px solid rgba(15, 23, 42, 0.04);' : ''}">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <strong style="color: #000000; font-weight: 700;">${nameDisp}</strong>
                                <span class="seva-badge assigned" style="padding: 2px 8px; font-size: 10px; border-radius: 12px; background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.25);">${item.duty.toUpperCase()}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; font-size: 11px; color: var(--text-muted);">
                                <span>Room: <strong style="color:#000;">${item.roomNum}</strong></span>
                                <span>Departs: <strong style="color:var(--accent-red); font-weight:700;">${formattedDepDate}</strong></span>
                            </div>
                        </div>
                    `;
                });

                box.innerHTML = html;
                allocatedContainer.appendChild(box);
            });
        }
    }

    function renderDeptWiseList() {
        const container = document.getElementById('seva-dept-summary-container');
        if (!container) return;
        container.innerHTML = '';

        // Query all rooms and find sevadharis
        let deptCounts = {}; // { deptName: totalCount }

        Object.values(state.rooms).forEach(room => {
            room.allocated.forEach(p => {
                if (p.type !== 'sevadhari') return;
                const duty = state.registration.sevaAllocations[p.id];
                if (duty) {
                    deptCounts[duty] = (deptCounts[duty] || 0) + 1;
                }
            });
        });

        const depts = Object.keys(deptCounts);
        if (depts.length === 0) {
            container.innerHTML = '<div style="color: #64748b; font-style: italic; text-align: center; padding: 30px 0; font-size: 13px;">No Seva duty assignments yet.</div>';
            return;
        }

        // Sort departments by count descending
        depts.sort((a, b) => deptCounts[b] - deptCounts[a]);

        depts.forEach(dept => {
            const card = document.createElement('div');
            card.className = 'programme-card';
            card.style.cursor = 'pointer';
            card.style.display = 'flex';
            card.style.justifyContent = 'space-between';
            card.style.alignItems = 'center';
            card.style.padding = '14px 16px';
            
            card.innerHTML = `
                <div class="prog-info">
                    <h3 style="font-size: 15px; font-weight: 700; color: var(--text-primary);">${dept.toUpperCase()}</h3>
                    <p style="font-size: 12px; color: var(--text-muted);">Assigned Sevadharis</p>
                </div>
                <span class="prog-badge regular" style="font-size: 12px; padding: 4px 12px; background: var(--accent-indigo); color: #fff;">Count: ${deptCounts[dept]}</span>
            `;

            card.addEventListener('click', () => {
                openDeptDetailsModal(dept);
            });

            container.appendChild(card);
        });
    }

    function openDeptDetailsModal(deptName) {
        const modal = document.getElementById('modal-dept-details');
        const titleEl = document.getElementById('modal-dept-title');
        const listEl = document.getElementById('modal-dept-sevadharis-list');

        if (!modal || !titleEl || !listEl) return;

        titleEl.textContent = deptName.toUpperCase();
        listEl.innerHTML = '';

        // Query all rooms and find sevadharis in this department
        let listItems = []; // list of { occupant, roomNum }
        Object.values(state.rooms).forEach(room => {
            room.allocated.forEach(p => {
                if (p.type !== 'sevadhari') return;
                const duty = state.registration.sevaAllocations[p.id];
                if (duty === deptName) {
                    listItems.push({ occupant: p, roomNum: room.number });
                }
            });
        });

        // Group by subcategory type (Mata, Kumari, Kumar, Adhar Kumar)
        const subcategoryOrder = ['Mata', 'Kumari', 'Kumar', 'Adhar Kumar', 'Children', 'Driver', 'Male', 'Female'];
        listItems.sort((a, b) => {
            let idxA = subcategoryOrder.indexOf(a.occupant.subcategory);
            let idxB = subcategoryOrder.indexOf(b.occupant.subcategory);
            if (idxA === -1) idxA = 999;
            if (idxB === -1) idxB = 999;
            return idxA - idxB;
        });

        listItems.forEach(item => {
            const p = item.occupant;
            const nameDisp = getOccupantDisplayName(p);
            const phoneDisp = p.phone || 'No Phone';
            const centreDisp = p.centre || 'Unknown';
            
            const row = document.createElement('div');
            row.style.padding = '8px 0';
            row.style.borderBottom = '1px solid rgba(15, 23, 42, 0.05)';
            row.style.display = 'flex';
            row.style.flexDirection = 'column';
            row.style.gap = '2px';

            row.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="color:var(--text-primary); font-size:14px; font-weight:700;">${nameDisp}</strong>
                    <span style="color:#ffffff; background:var(--accent-indigo); font-size:10px; font-weight:700; padding:1px 6px; border-radius:4px;">${p.subcategory}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--text-secondary); margin-top:2px;">
                    <span>Centre: <strong>${centreDisp}</strong> (Room ${item.roomNum})</span>
                    <span style="color:var(--accent-blue); font-weight:600; font-family:monospace;">📞 ${phoneDisp}</span>
                </div>
            `;
            listEl.appendChild(row);
        });

        modal.classList.add('active');
    }

    const closeDeptDetailsBtn = document.getElementById('btn-close-dept-details');
    if (closeDeptDetailsBtn) {
        closeDeptDetailsBtn.addEventListener('click', () => {
            document.getElementById('modal-dept-details').classList.remove('active');
        });
    }

    // Dynamic Niwasi Helper Functions
    function getDynamicNiwasiCounts() {
        let brotherCount = Object.values(state.niwasiStatus.brothers).filter(v => v).length;
        let sisterCount = Object.values(state.niwasiStatus.sisters).filter(v => v).length;
        let teacherOnCount = Object.values(state.niwasiStatus.teachers).filter(v => v).length;
        let teacherCount = teacherOnCount * 2;
        return {
            brother: brotherCount,
            sister: sisterCount,
            teacher: teacherCount,
            total: brotherCount + sisterCount + teacherCount
        };
    }

    function getDynamicNiwasiTotal() {
        return getDynamicNiwasiCounts().total;
    }

    function renderNiwasiBreakdownInModal(container) {
        container.innerHTML = '';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '10px';

        const counts = getDynamicNiwasiCounts();

        // 1. BK Brother Section
        const brotherSection = createNiwasiCategorySection('BK Brother', counts.brother, state.niwasiStatus.brothers, 'brothers');
        container.appendChild(brotherSection);

        // 2. BK Sister Section
        const sisterSection = createNiwasiCategorySection('BK Sister', counts.sister, state.niwasiStatus.sisters, 'sisters');
        container.appendChild(sisterSection);

        // 3. Senior Teacher Section (double count)
        const teacherSection = createNiwasiCategorySection('Senior Teacher', counts.teacher, state.niwasiStatus.teachers, 'teachers', true);
        container.appendChild(teacherSection);
    }

    function createNiwasiCategorySection(label, count, list, key, isDouble = false) {
        const row = document.createElement('div');
        row.className = 'niwasi-cat-row-clickable';
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.padding = '14px 16px';
        row.style.cursor = 'pointer';
        row.style.background = 'rgba(0, 0, 0, 0.03)';
        row.style.borderRadius = '10px';
        row.style.border = '1px solid rgba(0, 0, 0, 0.08)';
        row.style.transition = 'background 0.2s';
        
        row.innerHTML = `
            <span style="font-weight: 800; color: #000000; font-size: 16px;">${label}</span>
            <div style="display: flex; align-items: center; gap: 8px;">
                <span class="niwasi-cat-count-badge" style="background: var(--primary-gradient); color: #fff; padding: 3px 10px; border-radius: 20px; font-weight: 800; font-size: 14px;">${count}</span>
                <span style="color: #64748b; font-size: 11px;">▶</span>
            </div>
        `;

        row.addEventListener('click', () => {
            openNiwasiCategoryDetailsModal(label, list, key, isDouble, row.querySelector('.niwasi-cat-count-badge'));
        });

        return row;
    }

    function openNiwasiCategoryDetailsModal(label, list, key, isDouble, badgeEl) {
        const modal = document.getElementById('modal-niwasi-category-details');
        const titleEl = document.getElementById('modal-niwasi-cat-title');
        const contentEl = document.getElementById('modal-niwasi-cat-content');

        if (!modal || !titleEl || !contentEl) return;

        titleEl.textContent = `${label} List`;
        contentEl.innerHTML = '';

        Object.keys(list).forEach(name => {
            const isPresent = list[name];
            const nameRow = document.createElement('div');
            nameRow.className = 'niwasi-switch-container';
            nameRow.style.display = 'flex';
            nameRow.style.justifyContent = 'space-between';
            nameRow.style.alignItems = 'center';
            nameRow.style.padding = '10px 12px';
            nameRow.style.background = 'rgba(0, 0, 0, 0.02)';
            nameRow.style.borderRadius = '8px';
            nameRow.style.marginBottom = '6px';
            nameRow.style.border = '1px solid rgba(0, 0, 0, 0.05)';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'niwasi-switch-label';
            nameSpan.textContent = name;
            nameSpan.style.color = 'var(--text-primary)';
            nameSpan.style.fontSize = '15px';
            nameSpan.style.fontWeight = '700';
            
            const switchLabel = document.createElement('label');
            switchLabel.className = 'niwasi-switch';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = isPresent;
            if (state.currentUserRole === 'viewer') {
                checkbox.disabled = true;
            }

            checkbox.addEventListener('change', (e) => {
                const checked = e.target.checked;
                state.niwasiStatus[key][name] = checked;
                
                // Recalculate
                const newCounts = getDynamicNiwasiCounts();
                
                // Update badge count
                let displayCount = isDouble ? newCounts.teacher : (key === 'brothers' ? newCounts.brother : newCounts.sister);
                if (badgeEl) {
                    badgeEl.textContent = displayCount;
                }
                
                // Update main dashboard stats and save
                updateDashboardStats();
            });

            const slider = document.createElement('span');
            slider.className = 'niwasi-slider';
            slider.innerHTML = `
                <span class="slider-text-on">Present</span>
                <span class="slider-text-off">Absent</span>
            `;

            switchLabel.appendChild(checkbox);
            switchLabel.appendChild(slider);
            
            nameRow.appendChild(nameSpan);
            nameRow.appendChild(switchLabel);
            contentEl.appendChild(nameRow);
        });

        modal.classList.add('active');
    }

    // ----------------------------------------------------
    // LOGIN & USER ROLE MANAGEMENT
    // ----------------------------------------------------
    function applyRoleSettings() {
        const appEl = document.getElementById('app');
        const loginEl = document.getElementById('screen-login');
        
        if (!state.currentUserRole) {
            // Not logged in -> Show login screen, hide main app
            if (loginEl) loginEl.style.display = 'flex';
            if (appEl) appEl.style.display = 'none';
            return;
        }

        // Logged in -> Hide login screen, show app
        if (loginEl) loginEl.style.display = 'none';
        if (appEl) appEl.style.display = 'block';

        const isViewer = state.currentUserRole === 'viewer';
        
        // Past programme deletes are now handled per individual card

        // 1. Hide Add Programme Trigger
        const addProgBtn = document.getElementById('btn-add-programme-trigger');
        if (addProgBtn) addProgBtn.style.display = isViewer ? 'none' : 'block';

        // 2. Hide Room Visualization button
        const roomVizShortcutBtn = document.getElementById('btn-room-viz-shortcut');
        if (roomVizShortcutBtn) roomVizShortcutBtn.style.display = isViewer ? 'none' : 'block';

        // 3. Hide Register and Finish options inside Action Chooser
        const chooserReg = document.getElementById('btn-chooser-register');
        const chooserFinish = document.getElementById('btn-chooser-finish');
        if (chooserReg) chooserReg.style.display = isViewer ? 'none' : 'block';
        if (chooserFinish) chooserFinish.style.display = isViewer ? 'none' : 'block';

        // 4. User settings menu adjustments
        const adminSection = document.getElementById('admin-settings-section');
        if (adminSection) adminSection.style.display = isViewer ? 'none' : 'block';
        
        const roleLabel = document.getElementById('user-menu-role');
        if (roleLabel) roleLabel.textContent = state.currentUserRole;

        const viewerPassInput = document.getElementById('input-viewer-password');
        if (viewerPassInput) viewerPassInput.value = state.viewerPassword || '';
    }

    // Bind login actions
    document.getElementById('btn-login-action').addEventListener('click', handleLogin);
    document.getElementById('input-login-password').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') handleLogin();
    });

    function handleLogin() {
        const passwordInput = document.getElementById('input-login-password');
        const errorEl = document.getElementById('login-error-msg');
        const password = passwordInput.value;

        if (password === 'rss@src') {
            state.currentUserRole = 'admin';
            errorEl.style.display = 'none';
            passwordInput.value = '';
            applyRoleSettings();
            saveState(false);
        } else if (password === state.viewerPassword) {
            state.currentUserRole = 'viewer';
            errorEl.style.display = 'none';
            passwordInput.value = '';
            applyRoleSettings();
            saveState(false);
        } else {
            errorEl.textContent = 'Incorrect Password!';
            errorEl.style.display = 'block';
        }
    }

    // User Menu Modal Triggers
    document.getElementById('btn-user-menu-trigger').addEventListener('click', () => {
        applyRoleSettings();
        document.getElementById('modal-user-menu').classList.add('active');
    });

    document.getElementById('btn-close-user-menu').addEventListener('click', () => {
        document.getElementById('modal-user-menu').classList.remove('active');
    });

    document.getElementById('btn-user-logout').addEventListener('click', () => {
        state.currentUserRole = null;
        document.getElementById('modal-user-menu').classList.remove('active');
        document.getElementById('input-login-password').value = '';
        document.getElementById('login-error-msg').style.display = 'none';
        applyRoleSettings();
        saveState(false);
    });

    document.getElementById('btn-save-viewer-password').addEventListener('click', () => {
        const newPassword = document.getElementById('input-viewer-password').value;
        if (!newPassword) {
            alert('Viewer password cannot be empty!');
            return;
        }
        state.viewerPassword = newPassword;
        saveState();
        alert('Viewer password saved successfully!');
        document.getElementById('modal-user-menu').classList.remove('active');
    });

    // Password visibility toggle click listener
    const togglePassBtn = document.getElementById('btn-toggle-password-visibility');
    if (togglePassBtn) {
        togglePassBtn.addEventListener('click', () => {
            const passwordInput = document.getElementById('input-login-password');
            const eyeOpen = document.getElementById('eye-icon-open');
            const eyeClosed = document.getElementById('eye-icon-closed');

            if (passwordInput && eyeOpen && eyeClosed) {
                const isPassword = passwordInput.type === 'password';
                passwordInput.type = isPassword ? 'text' : 'password';
                passwordInput.style.letterSpacing = isPassword ? 'normal' : '4px';
                eyeOpen.style.display = isPassword ? 'none' : 'block';
                eyeClosed.style.display = isPassword ? 'block' : 'none';
            }
        });
    }

    // Run role enforcement on startup
    applyRoleSettings();
});
