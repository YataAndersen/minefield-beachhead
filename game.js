        import * as THREE from 'three';
        import gsap from 'gsap';
        import { Howl, Howler } from 'howler';

        if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
            navigator.serviceWorker?.getRegistrations?.().then((registrations) => {
                registrations.forEach((registration) => registration.unregister());
            });
        }


        const GRID_SIZE = 10;
        let MINES_COUNT = 15;
        let currentSector = 1;
        const MAX_SECTORS = 5;
        const SECTOR_PLAN = [
            { name: 'Landing Strip', mines: 12, reward: 80, drain: 0.55, briefing: 'Easy entry. Learn the rhythm without getting crushed.' },
            { name: 'Wire Garden', mines: 18, reward: 125, drain: 0.9, briefing: 'Tension starts to show. Flags stop being decoration.' },
            { name: 'Broken Relay', mines: 23, reward: 175, drain: 1.25, briefing: 'SCAN becomes a core survival tool.' },
            { name: 'Black Trench', mines: 29, reward: 240, drain: 1.65, briefing: 'Almost a final mission. Scout and rations pay for themselves.' },
            { name: 'Signal Nest', mines: 34, reward: 340, drain: 2.05, briefing: 'True finale. Every click must justify the risk.' }
        ];
        let fragmentsCollected = 0;
        let operationActive = false;
        let gameMode = 'classic';
        let focus = 100;
        let scoutNextSector = 0;

        // Route economy. Advance is the baseline: full reward, no cost.
        // Resupply trades supplies for focus, Scout trades focus for intel.
        const getRationCost = (reward) => Math.min(reward, Math.max(24, Math.round(reward * 0.35)));
        const getScoutCost = (nextSector) => 10 + nextSector * 2;
        const getScoutMarks = (nextSector) => 1 + Math.floor(nextSector / 2);
        let pendingSectorReward = 0;
        let pendingRouteChoice = 'advance';
        let sectorDrainMultiplier = 1;
        let sectorScanUsed = false;
        let sectorMineHits = 0;


        const gadgets = {
            sonar: { charges: 2, cooldown: false, cost: 15 }
        };


        const secureStorage = {
            get: (key, fallback) => { try { return parseInt(atob(localStorage.getItem(key)).replace('mf_salt_', '')) || fallback; } catch(e) { return fallback; } },
            set: (key, value) => { localStorage.setItem(key, btoa('mf_salt_' + value)); }
        };

        const UPGRADE_RULES = {
            shielding: { baseCost: 200, stepCost: 140, maxLevel: 4, focusBonus: 20 },
            searchAlgo: { baseCost: 300, stepCost: 180, maxLevel: 4 },
            neuralSync: { baseCost: 150, stepCost: 130, maxLevel: 3, sonarDiscount: 3 }
        };

        const clampUpgradeLevel = (type, value) => Math.max(0, Math.min(UPGRADE_RULES[type].maxLevel, value || 0));


        const OPERATOR_DATA = {
            totalFragments: secureStorage.get('mf_fragments_sec', 0),
            upgrades: {
                shielding: clampUpgradeLevel('shielding', secureStorage.get('mf_up_shielding_sec', 0)),
                searchAlgo: clampUpgradeLevel('searchAlgo', secureStorage.get('mf_up_search_sec', 0)),
                neuralSync: clampUpgradeLevel('neuralSync', secureStorage.get('mf_up_sync_sec', 0)),
            },
            save() {
                secureStorage.set('mf_fragments_sec', this.totalFragments);
                secureStorage.set('mf_up_shielding_sec', this.upgrades.shielding);
                secureStorage.set('mf_up_search_sec', this.upgrades.searchAlgo);
                secureStorage.set('mf_up_sync_sec', this.upgrades.neuralSync);
            }
        };

        let gameOver = false;
        let firstClick = true;
        let timer = 0;
        let timerInterval = null;
        let rogueliteTimer = null;
        let pressedInstanceId = null;
        let longPressTimer = null;
        let isLongPress = false;
        let flagsPlaced = 0;
        let cellsRevealed = 0;
        const flagsMap = new Map();



        // - assets/sfx/bgm_minefield_signal_menu_loop.mp3
        // - assets/sfx/bgm_minefield_signal_operation_loop.mp3

        const uiTimer = document.getElementById('timer-display');
        const uiSmiley = document.getElementById('smiley-btn');
        const uiSmileyImg = document.getElementById('smiley-img');
        const uiFocus = document.getElementById('focus-display');
        const uiSector = document.getElementById('sector-display');
        const mapScreen = document.getElementById('map-screen');
        const minesDisplay = document.getElementById('mines-display');
        const reportTitle = document.getElementById('report-title');
        const reportCopy = document.getElementById('report-copy');
        const reportEarned = document.getElementById('report-earned');
        const reportTotal = document.getElementById('report-total');
        const reportSector = document.getElementById('report-sector');
        const reportFocus = document.getElementById('report-focus');
        const reportHubButton = document.getElementById('btn-report-hub');
        const reportRetryButton = document.getElementById('btn-report-retry');
        const reportHomeButton = document.getElementById('btn-report-home');
        const reportResetButton = document.getElementById('btn-report-reset');
        const fieldNotice = document.getElementById('field-notice');
        const choiceNextSector = document.getElementById('choice-next-sector');
        const choiceNextThreat = document.getElementById('choice-next-threat');
        const choiceCurrentFocus = document.getElementById('choice-current-focus');
        const choiceRunSupplies = document.getElementById('choice-run-supplies');
        const choiceAdvanceCopy = document.getElementById('choice-advance-copy');
        const choiceResupplyCopy = document.getElementById('choice-resupply-copy');
        const choiceScoutCopy = document.getElementById('choice-scout-copy');
        const choiceAdvanceTag = document.getElementById('choice-advance-tag');
        const choiceResupplyTag = document.getElementById('choice-resupply-tag');
        const choiceScoutTag = document.getElementById('choice-scout-tag');
        const saveSummary = document.getElementById('save-summary');
        const continueCampaignButton = document.getElementById('btn-continue-campaign');
        const resetProgressButton = document.getElementById('btn-reset-progress');
        const soundToggleButton = document.getElementById('sound-toggle');
        const layoutToggleButton = document.getElementById('layout-toggle');

        uiSmileyImg.addEventListener('error', () => {
            uiSmileyImg.alt = `Missing operator image: ${uiSmileyImg.getAttribute('src') || 'unknown source'}`;
            uiSmileyImg.removeAttribute('src');
        });

        const getSectorPlan = (sector = currentSector) => SECTOR_PLAN[Math.max(0, Math.min(SECTOR_PLAN.length - 1, sector - 1))];
        const getMaxFocus = () => 100 + (OPERATOR_DATA.upgrades.shielding * UPGRADE_RULES.shielding.focusBonus);
        const padSector = (sector) => sector.toString().padStart(2, '0');
        function getSectorHudLabel(sector = currentSector) {
            const phoneLandscape = typeof isPhoneLikeViewport === 'function' &&
                typeof isPortraitViewport === 'function' &&
                isPhoneLikeViewport() &&
                !isPortraitViewport();
            return phoneLandscape
                ? `S:${padSector(sector)}/${padSector(MAX_SECTORS)}`
                : `S:${padSector(sector)}/${padSector(MAX_SECTORS)} ${getSectorPlan(sector).name}`;
        }
        const formatFocus = (value) => Math.max(0, Math.ceil(value));
        let mobileLayoutPreference = localStorage.getItem('mf_mobile_layout') || 'auto';
        function getEffectivePortraitLayout() {
            return isPortraitViewport() || (isPhoneLikeViewport() && mobileLayoutPreference === 'portrait');
        }
        function getEffectiveLandscapeLayout() {
            return isPhoneLikeViewport() && !getEffectivePortraitLayout();
        }
        function syncLayoutToggleLabel() {
            if (!layoutToggleButton) return;
            const usingPortrait = getEffectivePortraitLayout();
            layoutToggleButton.innerText = usingPortrait ? 'Side HUD' : 'Portrait HUD';
            layoutToggleButton.setAttribute('aria-pressed', String(usingPortrait));
            layoutToggleButton.title = usingPortrait
                ? 'Switch to the compact side HUD layout.'
                : 'Force the vertical HUD layout if auto-detection fails.';
        }
        function refreshSectorHudLabel() {
            if (gameMode === 'roguelike' && uiSector) {
                uiSector.innerText = getSectorHudLabel(currentSector);
            }
        }
        function setMobileLayoutPreference(nextPreference) {
            mobileLayoutPreference = nextPreference;
            localStorage.setItem('mf_mobile_layout', mobileLayoutPreference);
            syncViewportClass();
            refreshSectorHudLabel();
            applyViewportResize();
            showFieldNotice(mobileLayoutPreference === 'portrait' ? 'Portrait layout locked.' : 'Auto side HUD enabled.', 'neutral');
        }
        const getUpgradeCost = (type) => UPGRADE_RULES[type].baseCost + (OPERATOR_DATA.upgrades[type] * UPGRADE_RULES[type].stepCost);
        const getMineDamage = () => {
            if (currentSector === 1 && sectorMineHits === 0) return 14;
            return [0, 18, 23, 28, 34, 42][currentSector] || 28;
        };

        const audioState = {
            context: null,
            muted: localStorage.getItem('mf_audio_muted') === 'true',
            disabled: false,
            unlocked: false,
            activeVoices: 0,
            maxVoices: 8,
            failureCount: 0,
            noiseBuffer: null,
            lastPlayed: new Map()
        };

        const sfxCooldowns = {
            dig: 45,
            marker: 70,
            unmarker: 70,
            damage: 180,
            descend: 220,
            sonar: 260,
            explosion: 360,
            upgrade: 220,
            error: 180
        };

        const getAudioContext = () => {
            audioState.context ||= new (window.AudioContext || window.webkitAudioContext)();
            if (audioState.context.state === 'suspended') audioState.context.resume();
            return audioState.context;
        };

        const canPlaySfx = (name) => {
            if (audioState.muted || audioState.disabled || audioState.activeVoices >= audioState.maxVoices) return false;
            const now = performance.now();
            const cooldown = sfxCooldowns[name] || 80;
            if (now - (audioState.lastPlayed.get(name) || 0) < cooldown) return false;
            audioState.lastPlayed.set(name, now);
            return true;
        };

        const reserveVoice = (duration = 0.2) => {
            if (audioState.activeVoices >= audioState.maxVoices) return false;
            audioState.activeVoices++;
            window.setTimeout(() => {
                audioState.activeVoices = Math.max(0, audioState.activeVoices - 1);
            }, Math.ceil((duration + 0.05) * 1000));
            return true;
        };

        const disableAudioAfterFailure = () => {
            audioState.failureCount++;
            if (audioState.failureCount >= 3) {
                audioState.disabled = true;
                Howler.mute(true);
            }
        };

        const unlockAudio = () => {
            if (audioState.disabled || audioState.unlocked) return;
            try {
                const ctx = getAudioContext();
                const finishUnlock = () => {
                    audioState.unlocked = true;
                    audioState.failureCount = 0;
                    Howler.mute(audioState.muted);
                    if (sfx.wind?.state?.() === 'unloaded') sfx.wind.load();
                };
                if (ctx.state === 'running') {
                    finishUnlock();
                    return;
                }
                ctx.resume().then(finishUnlock).catch(disableAudioAfterFailure);
            } catch(e) {
                disableAudioAfterFailure();
            }
        };

        const getNoiseBuffer = (ctx) => {
            if (audioState.noiseBuffer) return audioState.noiseBuffer;
            const duration = 0.55;
            const buffer = ctx.createBuffer(1, Math.max(1, ctx.sampleRate * duration), ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
            }
            audioState.noiseBuffer = buffer;
            return buffer;
        };

        const playTone = ({
            frequency = 330,
            endFrequency = frequency,
            duration = 0.14,
            type = 'triangle',
            volume = 0.05,
            delay = 0,
            filter = null
        } = {}) => {
            if (audioState.muted || audioState.disabled || !reserveVoice(duration + delay)) return null;
            try {
                const ctx = getAudioContext();
                const now = ctx.currentTime + delay;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const destination = filter ? ctx.createBiquadFilter() : gain;
                osc.type = type;
                osc.frequency.setValueAtTime(frequency, now);
                osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + Math.max(0.02, duration * 0.75));
                gain.gain.setValueAtTime(0.0001, now);
                gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
                osc.start(now);
                osc.stop(now + duration + 0.02);
                osc.connect(gain);
                if (filter) {
                    destination.type = filter.type;
                    destination.frequency.setValueAtTime(filter.frequency, now);
                    destination.Q.setValueAtTime(filter.q || 1, now);
                    gain.connect(destination);
                    destination.connect(ctx.destination);
                } else {
                    gain.connect(ctx.destination);
                }
                return Math.random();
            } catch(e) {
                // Audio feedback is optional; gameplay should never depend on it.
                disableAudioAfterFailure();
                return null;
            }
        };

        const playNoise = ({ duration = 0.28, volume = 0.09, filterFrequency = 180, delay = 0 } = {}) => {
            if (audioState.muted || audioState.disabled || !reserveVoice(duration + delay)) return null;
            try {
                const ctx = getAudioContext();
                const now = ctx.currentTime + delay;
                const source = ctx.createBufferSource();
                const filter = ctx.createBiquadFilter();
                const gain = ctx.createGain();
                source.buffer = getNoiseBuffer(ctx);
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(filterFrequency, now);
                gain.gain.setValueAtTime(volume, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
                source.connect(filter);
                filter.connect(gain);
                gain.connect(ctx.destination);
                source.start(now);
                source.stop(now + duration);
                return Math.random();
            } catch(e) {
                disableAudioAfterFailure();
                return null;
            }
        };

        const createProceduralSfx = (name) => ({
            play() {
                unlockAudio();
                if (!canPlaySfx(name)) return null;
                const patterns = {
                    dig: () => playTone({ frequency: 260, endFrequency: 190, duration: 0.08, type: 'square', volume: 0.04, filter: { type: 'lowpass', frequency: 900, q: 0.5 } }),
                    marker: () => playTone({ frequency: 620, endFrequency: 840, duration: 0.09, type: 'triangle', volume: 0.055 }),
                    unmarker: () => playTone({ frequency: 520, endFrequency: 340, duration: 0.08, type: 'triangle', volume: 0.05 }),
                    damage: () => {
                        playTone({ frequency: 180, endFrequency: 80, duration: 0.24, type: 'sawtooth', volume: 0.075 });
                        return playNoise({ duration: 0.18, volume: 0.05, filterFrequency: 360 });
                    },
                    descend: () => {
                        playTone({ frequency: 420, endFrequency: 220, duration: 0.16, type: 'triangle', volume: 0.035 });
                        return playTone({ frequency: 260, endFrequency: 160, duration: 0.18, type: 'sine', volume: 0.025, delay: 0.08 });
                    },
                    sonar: () => {
                        playTone({ frequency: 460, endFrequency: 920, duration: 0.18, type: 'sine', volume: 0.055 });
                        return playTone({ frequency: 920, endFrequency: 1380, duration: 0.22, type: 'triangle', volume: 0.035, delay: 0.14 });
                    },
                    explosion: () => {
                        playTone({ frequency: 120, endFrequency: 42, duration: 0.38, type: 'sawtooth', volume: 0.105 });
                        return playNoise({ duration: 0.42, volume: 0.14, filterFrequency: 220 });
                    },
                    upgrade: () => {
                        playTone({ frequency: 520, endFrequency: 660, duration: 0.11, type: 'triangle', volume: 0.04 });
                        playTone({ frequency: 660, endFrequency: 880, duration: 0.12, type: 'triangle', volume: 0.04, delay: 0.08 });
                        return playTone({ frequency: 880, endFrequency: 1320, duration: 0.16, type: 'sine', volume: 0.035, delay: 0.17 });
                    },
                    error: () => {
                        playTone({ frequency: 155, endFrequency: 115, duration: 0.16, type: 'sawtooth', volume: 0.045 });
                        return playTone({ frequency: 115, endFrequency: 95, duration: 0.16, type: 'sawtooth', volume: 0.035, delay: 0.12 });
                    }
                };
                return patterns[name]?.() ?? null;
            },
            stop() {},
            pause() {},
            rate() {},
            playing() { return false; }
        });

        const sfx = {
            dig: createProceduralSfx('dig'),
            marker: createProceduralSfx('marker'),
            unmarker: createProceduralSfx('unmarker'),
            damage: createProceduralSfx('damage'),
            descend: createProceduralSfx('descend'),
            sonar: createProceduralSfx('sonar'),
            explosion: createProceduralSfx('explosion'),
            upgrade: createProceduralSfx('upgrade'),
            error: createProceduralSfx('error'),
            wind: new Howl({
                src: ['./assets/sfx/bgm_minefield_signal_operation_loop.mp3'],
                volume: 0.25,
                loop: true,
                mute: audioState.muted
            })
        };

        function updateSoundToggle() {
            if (!soundToggleButton) return;
            soundToggleButton.setAttribute('aria-pressed', String(!audioState.muted));
            soundToggleButton.setAttribute('aria-label', audioState.muted ? 'Turn sound on' : 'Turn sound off');
            soundToggleButton.querySelector('[data-sound-icon]').textContent = audioState.muted ? 'OFF' : 'ON';
        }

        function setMuted(muted) {
            audioState.muted = muted;
            localStorage.setItem('mf_audio_muted', String(muted));
            Howler.mute(muted);
            updateSoundToggle();
        }

        updateSoundToggle();
        Howler.mute(audioState.muted);

        soundToggleButton?.addEventListener('click', () => {
            unlockAudio();
            setMuted(!audioState.muted);
            if (!audioState.muted) sfx.marker.play();
        });
        layoutToggleButton?.addEventListener('click', () => {
            const nextPreference = getEffectivePortraitLayout() ? 'auto' : 'portrait';
            setMobileLayoutPreference(nextPreference);
        });

        ['pointerdown', 'touchstart', 'keydown'].forEach((eventName) => {
            window.addEventListener(eventName, unlockAudio, { once: true, passive: true });
        });

        window.__minefieldAudioDiagnostics = () => ({
            muted: audioState.muted,
            disabled: audioState.disabled,
            unlocked: audioState.unlocked,
            contextState: audioState.context?.state || 'none',
            activeVoices: audioState.activeVoices,
            maxVoices: audioState.maxVoices,
            failureCount: audioState.failureCount,
            hasNoiseBuffer: Boolean(audioState.noiseBuffer)
        });

        window.__minefieldAudioStress = () => {
            const wasMuted = audioState.muted;
            if (wasMuted) setMuted(false);
            for (let i = 0; i < 25; i++) {
                sfx.dig.play();
                sfx.marker.play();
                sfx.sonar.play();
                sfx.upgrade.play();
                sfx.explosion.play();
            }
            if (wasMuted) setMuted(true);
            return window.__minefieldAudioDiagnostics();
        };

        function showFieldNotice(message, tone = 'neutral') {
            if (!fieldNotice || !message) return;
            const color = tone === 'danger' ? '#fca5a5' : tone === 'success' ? '#a7f3d0' : '#f4e7b1';
            const hold = tone === 'danger' ? 2.1 : tone === 'success' ? 1.85 : 1.65;
            const noticeOverScreen = ['map-screen', 'hub-screen', 'tutorial-screen', 'sector-choice-screen', 'report-screen']
                .some((id) => {
                    const screen = document.getElementById(id);
                    return screen && !screen.classList.contains('hidden');
                });
            const hudBottom = document.getElementById('ui-layer')?.getBoundingClientRect().bottom || 0;
            const topOffset = noticeOverScreen ? 8 : Math.max(hudBottom + 8, 8);
            fieldNotice.textContent = message;
            fieldNotice.style.color = color;
            fieldNotice.style.setProperty('top', `${topOffset}px`, 'important');
            fieldNotice.classList.toggle('is-screen-notice', noticeOverScreen);
            gsap.killTweensOf(fieldNotice);
            gsap.fromTo(fieldNotice,
                { opacity: 0, y: -8 },
                { opacity: 1, y: 0, duration: 0.18, ease: 'power2.out' }
            );
            gsap.to(fieldNotice, { opacity: 0, y: -6, duration: 0.28, delay: hold, ease: 'power2.in' });
        }


        function transitionTo(screenId, callback = null) {
            const overlay = document.getElementById('transition-overlay');
            overlay.classList.remove('hidden');
            gsap.to(overlay, { opacity: 1, duration: 0.4, ease: "power2.inOut", onComplete: () => {
                document.getElementById('map-screen').classList.add('hidden');
                document.getElementById('hub-screen').classList.add('hidden');
                document.getElementById('tutorial-screen').classList.add('hidden');
                document.getElementById('report-screen').classList.add('hidden');
                document.getElementById('sector-choice-screen').classList.add('hidden');
                if (callback) callback();
                if (screenId) document.getElementById(screenId).classList.remove('hidden');
                gsap.to(overlay, { opacity: 0, duration: 0.6, ease: "power2.out", delay: 0.1, onComplete: () => overlay.classList.add('hidden') });
            }});
        }

        function openHomeScreen() {
            gameOver = true;
            operationActive = false;
            clearInterval(timerInterval);
            clearInterval(rogueliteTimer);
            sfx.wind.pause();
            transitionTo('map-screen', () => {
                updateSaveSummary();
            });
        }

        const actionBar = document.getElementById('action-bar');
        const flagToggleButton = document.getElementById('flag-toggle');
        const scanButton = document.getElementById('scan-button');
        const hudRightCluster = document.querySelector('.hud-cluster-right');
        let flagMode = false;

        function setFlagMode(next) {
            flagMode = next;
            flagToggleButton.setAttribute('aria-pressed', String(flagMode));
            showFieldNotice(flagMode ? 'Flag mode on. Tap a tile to mark it.' : 'Flag mode off. Tap to clear a tile.', 'neutral');
        }

        flagToggleButton.addEventListener('click', () => setFlagMode(!flagMode));

        // SCAN lives in the HUD on every layout except the portrait phone, where
        // it moves into the action bar so it is reachable without stretching.
        function syncActionBarSlots() {
            if (!actionBar || !scanButton || !hudRightCluster) return;
            const useActionBar = isPhoneLikeViewport() && getEffectivePortraitLayout();
            if (useActionBar) {
                if (scanButton.parentElement !== actionBar) actionBar.appendChild(scanButton);
            } else if (scanButton.parentElement !== hudRightCluster) {
                hudRightCluster.insertBefore(scanButton, soundToggleButton);
            }
        }

        let restartArmed = false;
        let restartArmTimer = null;

        function disarmRestart() {
            restartArmed = false;
            clearTimeout(restartArmTimer);
            uiSmiley.classList.remove('is-armed');
        }

        function armRestart() {
            restartArmed = true;
            uiSmiley.classList.add('is-armed');
            clearTimeout(restartArmTimer);
            restartArmTimer = setTimeout(disarmRestart, 3000);
            showFieldNotice(gameMode === 'roguelike'
                ? 'Restart the sector? Tap again. Focus carries over.'
                : 'Restart the field? Tap again.', 'danger');
        }

        // Restarting used to fire on pointerdown with no confirmation, so a
        // mistap threw the board away. In the campaign it also refilled focus
        // while keeping the sector, which turned the operator portrait into a
        // free reset of the run's pressure.
        uiSmiley.addEventListener('click', () => {
            if(gameOver) { disarmRestart(); openHomeScreen(); return; }
            if(!restartArmed) { armRestart(); return; }
            disarmRestart();
            resetRoom({ preserveFocus: true });
        });

        const isScreenOpen = (id) => !document.getElementById(id).classList.contains('hidden');
        const isMenuOpen = () => isScreenOpen('map-screen') || isScreenOpen('hub-screen') || isScreenOpen('tutorial-screen') || isScreenOpen('sector-choice-screen') || isScreenOpen('report-screen');

        function setModeClass(mode) {
            document.body.classList.toggle('mode-classic', mode === 'classic');
            document.body.classList.toggle('mode-roguelike', mode === 'roguelike');
        }
        setModeClass(gameMode);

        function bindStartButton(id, mines, mode) {
            const button = document.getElementById(id);
            const start = (event) => {
                event.preventDefault();
                event.stopPropagation();
                requestPortraitOrientation();
                if (!isScreenOpen('map-screen')) return;
                startRoom(mines, mode);
            };

            button.addEventListener('pointerup', start);
            button.addEventListener('click', start);
        }

        bindStartButton('btn-node-normal', 15, 'classic');
        bindStartButton('btn-node-desafio', 22, 'roguelike');

        function updateSaveSummary() {
            if (!saveSummary) return;
            const upgradeTotal = OPERATOR_DATA.upgrades.shielding + OPERATOR_DATA.upgrades.searchAlgo + OPERATOR_DATA.upgrades.neuralSync;
            saveSummary.innerText = `${OPERATOR_DATA.totalFragments.toString().padStart(3, '0')} \u00b7 ${upgradeTotal} upgrades`;
            if (continueCampaignButton) continueCampaignButton.disabled = false;
        }

        function resetLocalProgress() {
            OPERATOR_DATA.totalFragments = 0;
            OPERATOR_DATA.upgrades.shielding = 0;
            OPERATOR_DATA.upgrades.searchAlgo = 0;
            OPERATOR_DATA.upgrades.neuralSync = 0;
            OPERATOR_DATA.save();
            updateSaveSummary();
            updateHubUI();
            sfx.error.play();
            showFieldNotice('Local progress reset. The campaign starts clean.', 'danger');
        }

        continueCampaignButton?.addEventListener('click', () => {
            requestPortraitOrientation();
            startRoom(22, 'roguelike');
        });
        resetProgressButton?.addEventListener('click', resetLocalProgress);
        updateSaveSummary();


        function updateHubUI() {
            document.getElementById('hub-fragments').innerText = OPERATOR_DATA.totalFragments.toString().padStart(3, '0');
            document.getElementById('up-shielding-lvl').innerText = `LVL: ${OPERATOR_DATA.upgrades.shielding}/${UPGRADE_RULES.shielding.maxLevel} (+${UPGRADE_RULES.shielding.focusBonus} focus)`;
            document.getElementById('up-search-lvl').innerText = `LVL: ${OPERATOR_DATA.upgrades.searchAlgo}/${UPGRADE_RULES.searchAlgo.maxLevel} (marks mines)`;
            document.getElementById('up-sync-lvl').innerText = `LVL: ${OPERATOR_DATA.upgrades.neuralSync}/${UPGRADE_RULES.neuralSync.maxLevel} (-${UPGRADE_RULES.neuralSync.sonarDiscount} SCAN)`;

            document.getElementById('btn-up-shielding').innerText = OPERATOR_DATA.upgrades.shielding >= UPGRADE_RULES.shielding.maxLevel ? 'MAX' : `COST: ${getUpgradeCost('shielding')}`;
            document.getElementById('btn-up-search').innerText = OPERATOR_DATA.upgrades.searchAlgo >= UPGRADE_RULES.searchAlgo.maxLevel ? 'MAX' : `COST: ${getUpgradeCost('searchAlgo')}`;
            document.getElementById('btn-up-sync').innerText = OPERATOR_DATA.upgrades.neuralSync >= UPGRADE_RULES.neuralSync.maxLevel ? 'MAX' : `COST: ${getUpgradeCost('neuralSync')}`;
            updateSaveSummary();
        }

        function buyUpgrade(type) {
            if (OPERATOR_DATA.upgrades[type] >= UPGRADE_RULES[type].maxLevel) {
                sfx.error.play();
                gsap.to('#hub-screen', { x: -3, duration: 0.05, yoyo: true, repeat: 3 });
                return;
            }

            const cost = getUpgradeCost(type);

            if (OPERATOR_DATA.totalFragments >= cost) {
                OPERATOR_DATA.totalFragments -= cost;
                OPERATOR_DATA.upgrades[type]++;
                OPERATOR_DATA.save();
                updateHubUI();
                sfx.upgrade.play();
                const button = document.getElementById(type === 'shielding' ? 'btn-up-shielding' : type === 'searchAlgo' ? 'btn-up-search' : 'btn-up-sync');
                button.classList.remove('is-confirmed');
                void button.offsetWidth;
                button.classList.add('is-confirmed');
                showFieldNotice('Upgrade installed. Progress saved on this computer.', 'success');
            } else {
                sfx.error.play();
                showFieldNotice('Not enough supplies for this upgrade.', 'danger');
                gsap.to('#hub-screen', { x: -5, duration: 0.05, yoyo: true, repeat: 5 });
            }
        }

        document.getElementById('btn-open-hub').addEventListener('click', openHub);
        document.getElementById('btn-leave-hub').addEventListener('click', () => {
            transitionTo('map-screen');
        });
        document.getElementById('btn-open-tutorial').addEventListener('click', () => {
            transitionTo('tutorial-screen');
        });
        document.getElementById('btn-close-tutorial').addEventListener('click', () => {
            transitionTo('map-screen');
        });
        document.getElementById('btn-up-shielding').addEventListener('click', () => buyUpgrade('shielding'));
        document.getElementById('btn-up-search').addEventListener('click', () => buyUpgrade('searchAlgo'));
        document.getElementById('btn-up-sync').addEventListener('click', () => buyUpgrade('neuralSync'));

        function openHub() {
            transitionTo('hub-screen', updateHubUI);
        }

        function openReport({ title, copy, earned, sector = currentSector, focusLeft = focus, mode = gameMode }) {
            reportTitle.innerText = title;
            reportCopy.innerText = copy;
            reportEarned.innerText = earned.toString().padStart(3, '0');
            reportTotal.innerText = OPERATOR_DATA.totalFragments.toString().padStart(3, '0');
            reportSector.innerText = mode === 'classic'
                ? 'CLASSIC FIELD'
                : `${padSector(sector)}/${padSector(MAX_SECTORS)} ${getSectorPlan(sector).name}`;
            reportFocus.innerText = mode === 'classic'
                ? `T:${timer.toString().padStart(3, '0')}`
                : title === 'OPERATION COMPLETE' ? 'COMPLETE' : `F:${formatFocus(focusLeft)}%`;
            if (reportHubButton) reportHubButton.classList.toggle('hidden', mode === 'classic');
            if (reportResetButton) reportResetButton.classList.toggle('hidden', mode === 'classic');
            if (reportRetryButton) reportRetryButton.innerText = mode === 'classic' ? 'Play Classic Again' : 'Retry Campaign';
            transitionTo('report-screen');
        }

        function openSectorChoice(reward) {
            pendingSectorReward = reward;
            const nextSector = Math.min(MAX_SECTORS, currentSector + 1);
            const nextPlan = getSectorPlan(nextSector);
            const rationGain = Math.min(28, Math.max(16, Math.round(getMaxFocus() * 0.18)));
            const rationCost = getRationCost(pendingSectorReward);
            const scoutCost = getScoutCost(nextSector);
            const scoutMarks = getScoutMarks(nextSector);

            document.getElementById('choice-copy').innerText = `${getSectorPlan(currentSector).name} secured: +${reward} supplies. Command needs a route call for sector ${nextSector}: pressure, recovery, or intel.`;
            choiceNextSector.innerText = `${padSector(nextSector)}/${padSector(MAX_SECTORS)} - ${nextPlan.name}`;
            choiceNextThreat.innerText = `${nextPlan.mines} mines / ${nextPlan.briefing}`;
            choiceCurrentFocus.innerText = `F:${Math.max(0, Math.round(focus))}%`;
            choiceRunSupplies.innerText = fragmentsCollected.toString().padStart(3, '0');
            choiceAdvanceCopy.innerText = `Signal stays open. Enter ${nextPlan.name} now, with ${nextPlan.mines} mines, current focus, and full payout.`;
            choiceResupplyCopy.innerText = `Spend ${rationCost} supplies on rations. Recover ${rationGain} focus and reduce next-sector pressure.`;
            choiceScoutCopy.innerText = `Spend ${scoutCost} focus on recon. ${scoutMarks} mines are marked before you set foot in the sector.`;
            choiceAdvanceTag.innerText = `Full reward: +${nextPlan.reward} / pressure ${nextPlan.drain.toFixed(2)}x`;
            choiceResupplyTag.innerText = `+${rationGain} focus / -${rationCost} supplies / lower pressure`;
            choiceScoutTag.innerText = `${scoutMarks} mines marked / -${scoutCost} focus`;
            transitionTo('sector-choice-screen');
        }

        function continueAfterChoice(type) {
            const maxFocus = getMaxFocus();
            const nextSector = Math.min(MAX_SECTORS, currentSector + 1);
            const rationGain = Math.min(28, Math.max(16, Math.round(maxFocus * 0.18)));
            const scoutCost = getScoutCost(nextSector);
            const scoutMarks = getScoutMarks(nextSector);
            pendingRouteChoice = type;

            if (type === 'resupply') {
                const refund = getRationCost(pendingSectorReward);
                OPERATOR_DATA.totalFragments = Math.max(0, OPERATOR_DATA.totalFragments - refund);
                fragmentsCollected = Math.max(0, fragmentsCollected - refund);
                focus = Math.min(maxFocus, focus + rationGain);
                OPERATOR_DATA.save();
                updateSaveSummary();
                showFieldNotice(`Ration: +${rationGain} focus, -${refund} supplies. Lower pressure.`, 'success');
            }
            if (type === 'scout') {
                focus = Math.max(1, focus - scoutCost);
                scoutNextSector = scoutMarks;
                showFieldNotice(`Recon: ${scoutMarks} mines marked. Focus -${scoutCost}.`, 'neutral');
            }
            if (type === 'advance') {
                showFieldNotice('Direct advance: full reward, no recovery.', 'neutral');
            }

            transitionTo(null, () => {
                currentSector++;
                advanceToNextSector();
            });
        }

        reportHubButton?.addEventListener('click', openHub);
        reportRetryButton?.addEventListener('click', () => startRoom(gameMode === 'classic' ? 15 : 22, gameMode));
        reportHomeButton?.addEventListener('click', openHomeScreen);
        reportResetButton?.addEventListener('click', resetLocalProgress);
        document.getElementById('choice-advance').addEventListener('click', () => continueAfterChoice('advance'));
        document.getElementById('choice-resupply').addEventListener('click', () => continueAfterChoice('resupply'));
        document.getElementById('choice-scout').addEventListener('click', () => continueAfterChoice('scout'));
        document.getElementById('scan-button').addEventListener('click', triggerSonar);


        const CLASSIC_OPERATOR_IMAGES = {
            idle: './assets/icons/emoji_olhando_jogador.png',
            idleBlink: './assets/icons/emoji_piscada_olhando_jogador.png',
            active: './assets/icons/emoji_olhando_canva.png',
            activeBlink: './assets/icons/emoji_piscada_olhando_canva.png',
            damage: './assets/icons/emoji_assutado_olhando_player.png',
            death: './assets/icons/emoji_death_game_over.png',
        };
        const ROGUELITE_OPERATOR_IMAGES = {
            idle: './assets/icons/roguelite/operator_calm.png',
            idleBlink: './assets/icons/roguelite/operator_calm_blink.png',
            active: './assets/icons/roguelite/operator_tense.png',
            activeBlink: './assets/icons/roguelite/operator_tense_blink.png',
            damage: './assets/icons/roguelite/operator_panic.png',
            death: './assets/icons/roguelite/operator_death.png',
            alert: './assets/icons/roguelite/operator_panic_alt.png',
        };
        const getOperatorImages = () => gameMode === 'roguelike' ? ROGUELITE_OPERATOR_IMAGES : CLASSIC_OPERATOR_IMAGES;
        const menuEmojiClassic = document.getElementById('menu-emoji-classic');
        const menuEmojiOperator = document.getElementById('menu-emoji-operator');
        const menuEmojiActors = [
            { el: menuEmojiClassic, idle: CLASSIC_OPERATOR_IMAGES.idle, blink: CLASSIC_OPERATOR_IMAGES.idleBlink, alt: CLASSIC_OPERATOR_IMAGES.active, alert: CLASSIC_OPERATOR_IMAGES.damage },
            { el: menuEmojiOperator, idle: ROGUELITE_OPERATOR_IMAGES.damage, blink: ROGUELITE_OPERATOR_IMAGES.alert, alt: ROGUELITE_OPERATOR_IMAGES.active, alert: ROGUELITE_OPERATOR_IMAGES.death }
        ];

        let lastInteractionTime = performance.now();
        let isBlinking = false;
        let isDamaged = false;
        let isDead = false;
        let currentSmileySrc = CLASSIC_OPERATOR_IMAGES.idle;

        function updateSmileyFace() {
            if (isDead || isDamaged) return;

            const operatorImages = getOperatorImages();
            const timeSinceInteraction = performance.now() - lastInteractionTime;
            const isIdle = timeSinceInteraction > 4000; // 4 Segundos sem jogar
            let targetSrc = isIdle
                ? (isBlinking ? operatorImages.idleBlink : operatorImages.idle)
                : (isBlinking ? operatorImages.activeBlink : operatorImages.active);

            if (currentSmileySrc !== targetSrc) {
                uiSmileyImg.src = targetSrc;
                currentSmileySrc = targetSrc;
            }
        }

        function signalOperatorActivity(intensity = 1) {
            lastInteractionTime = performance.now();
            if (isDead || isDamaged) return;

            isBlinking = false;
            const targetSrc = getOperatorImages().active;
            if (currentSmileySrc !== targetSrc) {
                uiSmileyImg.src = targetSrc;
                currentSmileySrc = targetSrc;
            }

            gsap.killTweensOf(uiSmileyImg);
            gsap.fromTo(uiSmileyImg,
                { scale: 1 + (0.035 * intensity) },
                { scale: 1, duration: 0.2, ease: "power2.out" }
            );
        }

        function scheduleBlink() {
            const delay = 3000 + Math.random() * 4000;
            setTimeout(() => {
                if (!gameOver && !isDamaged && !isDead) {
                    isBlinking = true; updateSmileyFace();
                    setTimeout(() => { isBlinking = false; updateSmileyFace(); scheduleBlink(); }, 150); // Pisca por 150ms
                } else { scheduleBlink(); }
            }, delay);
        }
        scheduleBlink();

        function runMenuEmojiBeat(actor) {
            if (!actor?.el) return;
            const beat = Math.random();
            actor.el.classList.remove('is-jolt', 'is-breathe', 'is-alert');

            if (beat < 0.38) {
                actor.el.src = actor.blink;
                setTimeout(() => { actor.el.src = actor.idle; }, 140 + Math.random() * 90);
            } else if (beat < 0.68) {
                actor.el.src = actor.alt;
                actor.el.classList.add('is-breathe');
                setTimeout(() => {
                    actor.el.src = actor.idle;
                    actor.el.classList.remove('is-breathe');
                }, 900 + Math.random() * 450);
            } else if (beat < 0.88) {
                actor.el.src = actor.alert;
                actor.el.classList.add('is-alert', 'is-jolt');
                setTimeout(() => {
                    actor.el.src = actor.idle;
                    actor.el.classList.remove('is-alert', 'is-jolt');
                }, 360 + Math.random() * 260);
            } else {
                actor.el.classList.add('is-breathe');
                setTimeout(() => actor.el.classList.remove('is-breathe'), 1300);
            }
        }

        function scheduleMenuEmojiActor(actor, baseDelay = 900) {
            if (!actor?.el) return;
            const delay = baseDelay + Math.random() * 2400;
            setTimeout(() => {
                if (isScreenOpen('map-screen')) runMenuEmojiBeat(actor);
                scheduleMenuEmojiActor(actor, 1100);
            }, delay);
        }

        menuEmojiActors.forEach((actor, index) => {
            if (actor.el) actor.el.src = actor.idle;
            scheduleMenuEmojiActor(actor, 500 + index * 700);
        });


        function seedWarAtmosphereSparks() {
            const sparkSizes = [0.25, 0.38, 0.54, 0.72, 0.94, 1.18, 1.48, 2.05, 3.15, 5.1];

            function randomizeSpark(spark, index) {
                const depth = 0.45 + Math.random() * 1.05;
                const sizeBias = Math.pow(Math.random(), 1.65);
                const sizeIndex = index % 17 === 0
                    ? sparkSizes.length - 1
                    : Math.min(sparkSizes.length - 1, Math.floor(sizeBias * sparkSizes.length));
                const size = sparkSizes[sizeIndex];
                const driftA = (Math.random() - 0.5) * (70 + depth * 70);
                const driftB = driftA + (Math.random() - 0.5) * (96 + depth * 88);
                const driftC = (Math.random() - 0.5) * (112 + depth * 96);
                const startDrift = (Math.random() - 0.5) * 36;
                const isLarge = size > 3.8;
                const duration = isLarge
                    ? 8.4 + Math.random() * 5.6
                    : 2.2 + Math.random() * 6.6;
                spark.style.setProperty('--x', `${(Math.random() * 118 - 9).toFixed(3)}%`);
                spark.style.setProperty('--y', `${18 - Math.random() * 64}%`);
                spark.style.setProperty('--size', `${size.toFixed(2)}px`);
                spark.style.setProperty('--depth', depth.toFixed(2));
                spark.style.setProperty('--blur', `${(Math.random() * 0.5).toFixed(2)}px`);
                spark.style.setProperty('--opacity', `${(0.28 + Math.random() * 0.42).toFixed(2)}`);
                spark.style.setProperty('--rise', `${isLarge ? 76 + Math.random() * 52 : 58 + Math.random() * 108}vh`);
                spark.style.setProperty('--start-drift', `${startDrift.toFixed(1)}px`);
                spark.style.setProperty('--drift-a', `${driftA.toFixed(1)}px`);
                spark.style.setProperty('--drift-b', `${driftB.toFixed(1)}px`);
                spark.style.setProperty('--drift-c', `${driftC.toFixed(1)}px`);
                spark.style.setProperty('--duration', `${duration.toFixed(2)}s`);
            }

            document.querySelectorAll('.war-atmosphere').forEach((layer) => {
                if (layer.dataset.sparked === 'true') return;
                layer.dataset.sparked = 'true';

                for (let i = 0; i < 96; i++) {
                    const spark = document.createElement('span');
                    spark.className = 'war-spark';
                    randomizeSpark(spark, i);
                    spark.style.setProperty('--delay', `${Math.random() * -16}s`);
                    spark.addEventListener('animationiteration', () => randomizeSpark(spark, i));
                    layer.appendChild(spark);
                }
            });
        }

        seedWarAtmosphereSparks();

        const gridData = Array.from({ length: GRID_SIZE }, () =>
            Array.from({ length: GRID_SIZE }, () => ({ isMine: false, revealed: false, flagged: false, adjacent: 0 }))
        );

        // ============================================================================
        // No-guess board generator.
        //
        // The old placeMines dropped MINES_COUNT mines uniformly at random.
        // At sector 4-5 density (29-34 mines on a 10x10 board) that regularly
        // produces a board no amount of correct play can finish without a
        // coin flip -- confirmed by measurement, not just play feel: blind
        // rejection sampling (place randomly, check, retry) only reaches a
        // fully solvable 34-mine layout 3% of the time within a 400-attempt
        // budget, and needs thousands of attempts on average to succeed at
        // all, which is too slow for a first-click response.
        //
        // This instead builds the board up one mine at a time, keeping each
        // addition only if the board is still provably solvable by pure
        // deduction -- so it never has to rediscover global consistency from
        // scratch. Measured 400/400 successes at 29% and 34% density in
        // under 7ms worst case, including corner and edge first clicks.
        //
        // isNoGuessSolvable is deliberately conservative: single-point rule,
        // pairwise subset elimination, and a global remaining-mines/
        // remaining-cells endgame rule. It can say "needs a guess" about a
        // board a smarter solver could still crack (that only costs the
        // generator a wasted attempt), but cross-validated against an exact
        // brute-force solver over 20000 random boards, it never once claimed
        // solvable when the board actually required a guess -- the direction
        // that matters, since that's the one that would make this a false
        // promise to the player.
        const solverNeighborTable = (() => {
            const table = new Array(GRID_SIZE * GRID_SIZE);
            for (let i = 0; i < GRID_SIZE; i++) {
                for (let j = 0; j < GRID_SIZE; j++) {
                    const list = [];
                    for (let dx = -1; dx <= 1; dx++) {
                        for (let dy = -1; dy <= 1; dy++) {
                            if (dx === 0 && dy === 0) continue;
                            const nx = i + dx, ny = j + dy;
                            if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) list.push(nx * GRID_SIZE + ny);
                        }
                    }
                    table[i * GRID_SIZE + j] = list;
                }
            }
            return table;
        })();

        function computeSolverAdjacency(mines) {
            const total = GRID_SIZE * GRID_SIZE;
            const adj = new Uint8Array(total);
            for (let idx = 0; idx < total; idx++) {
                if (mines[idx]) continue;
                let c = 0;
                const nb = solverNeighborTable[idx];
                for (let k = 0; k < nb.length; k++) if (mines[nb[k]]) c++;
                adj[idx] = c;
            }
            return adj;
        }

        function solverFloodReveal(startIdx, adj, revealed) {
            if (revealed[startIdx]) return;
            const stack = [startIdx];
            while (stack.length) {
                const idx = stack.pop();
                if (revealed[idx]) continue;
                revealed[idx] = 1;
                if (adj[idx] === 0) {
                    const nb = solverNeighborTable[idx];
                    for (let k = 0; k < nb.length; k++) if (!revealed[nb[k]]) stack.push(nb[k]);
                }
            }
        }

        function isNoGuessSolvable(mines, mineCount, startIdx, adj) {
            const total = GRID_SIZE * GRID_SIZE;
            const revealed = new Uint8Array(total);
            const flaggedMine = new Uint8Array(total);
            let deducedMineCount = 0;
            solverFloodReveal(startIdx, adj, revealed);
            const revealAndCascade = (idx) => { if (!revealed[idx] && !flaggedMine[idx]) solverFloodReveal(idx, adj, revealed); };

            for (;;) {
                let progressed = false;
                const constraints = [];
                for (let idx = 0; idx < total; idx++) {
                    if (!revealed[idx] || adj[idx] === 0) continue;
                    const nb = solverNeighborTable[idx];
                    let need = adj[idx];
                    const unknown = [];
                    for (let k = 0; k < nb.length; k++) {
                        const n = nb[k];
                        if (flaggedMine[n]) { need--; continue; }
                        if (!revealed[n]) unknown.push(n);
                    }
                    if (unknown.length > 0) constraints.push({ cells: unknown, need });
                }

                for (const c of constraints) {
                    if (c.need === 0) {
                        for (const cell of c.cells) if (!revealed[cell] && !flaggedMine[cell]) { revealAndCascade(cell); progressed = true; }
                    } else if (c.need === c.cells.length) {
                        for (const cell of c.cells) if (!flaggedMine[cell]) { flaggedMine[cell] = 1; deducedMineCount++; progressed = true; }
                    }
                }
                if (progressed) continue;

                const remainingMines = mineCount - deducedMineCount;
                const unknownCells = [];
                for (let idx = 0; idx < total; idx++) if (!revealed[idx] && !flaggedMine[idx]) unknownCells.push(idx);
                if (unknownCells.length > 0) {
                    if (remainingMines === 0) {
                        for (const cell of unknownCells) { revealAndCascade(cell); progressed = true; }
                    } else if (remainingMines === unknownCells.length) {
                        for (const cell of unknownCells) { flaggedMine[cell] = 1; deducedMineCount++; progressed = true; }
                    }
                }
                if (progressed) continue;

                findSubset: for (let a = 0; a < constraints.length; a++) {
                    for (let b = 0; b < constraints.length; b++) {
                        if (a === b) continue;
                        const A = constraints[a], B = constraints[b];
                        if (B.cells.length === 0 || B.cells.length >= A.cells.length) continue;
                        const setA = A._set || (A._set = new Set(A.cells));
                        let subset = true;
                        for (const cell of B.cells) if (!setA.has(cell)) { subset = false; break; }
                        if (!subset) continue;
                        const diffCells = A.cells.filter((c) => !B.cells.includes(c));
                        const diffNeed = A.need - B.need;
                        if (diffNeed === 0) {
                            for (const cell of diffCells) if (!revealed[cell] && !flaggedMine[cell]) { revealAndCascade(cell); progressed = true; }
                            if (progressed) break findSubset;
                        } else if (diffNeed === diffCells.length && diffCells.length > 0) {
                            for (const cell of diffCells) if (!flaggedMine[cell]) { flaggedMine[cell] = 1; deducedMineCount++; progressed = true; }
                            if (progressed) break findSubset;
                        }
                    }
                }
                if (progressed) continue;
                break;
            }

            let revealedNonMine = 0;
            for (let idx = 0; idx < total; idx++) if (revealed[idx] && !mines[idx]) revealedNonMine++;
            return revealedNonMine === total - mineCount;
        }

        function shuffleInPlace(arr) {
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
            }
            return arr;
        }

        // Builds one candidate board by adding mines to random empty cells,
        // one at a time, keeping only the additions that leave the board
        // solvable. Returns how many of the mineCount mines it managed to
        // place this way.
        function tryBuildSolvableBoard(mineCount, startIdx, candidates, deadline) {
            const total = GRID_SIZE * GRID_SIZE;
            const mines = new Uint8Array(total);
            const remaining = shuffleInPlace(candidates.slice());
            let placed = 0;
            for (let cursor = 0; placed < mineCount && cursor < remaining.length; cursor++) {
                if (Date.now() > deadline) break;
                const cell = remaining[cursor];
                mines[cell] = 1;
                const adj = computeSolverAdjacency(mines);
                if (isNoGuessSolvable(mines, placed + 1, startIdx, adj)) {
                    placed++;
                } else {
                    mines[cell] = 0;
                }
            }
            return { mines, placed };
        }

        function generateNoGuessBoard(mineCount, safeX, safeY) {
            const total = GRID_SIZE * GRID_SIZE;
            const startIdx = safeX * GRID_SIZE + safeY;
            const excluded = new Uint8Array(total);
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    const nx = safeX + dx, ny = safeY + dy;
                    if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) excluded[nx * GRID_SIZE + ny] = 1;
                }
            }
            const candidates = [];
            for (let idx = 0; idx < total; idx++) if (!excluded[idx]) candidates.push(idx);

            // Generous safety margin over the ~7ms worst case measured on
            // desktop for the hardest sector; never observed to matter.
            const deadline = Date.now() + 350;
            let best = null;
            let restarts = 0;
            while (Date.now() < deadline && restarts < 60) {
                restarts++;
                const res = tryBuildSolvableBoard(mineCount, startIdx, candidates, deadline);
                if (!best || res.placed > best.placed) best = res;
                if (best.placed === mineCount) break;
            }

            // Defensive fallback: budget exhausted before reaching the full
            // mine count (not observed in testing, kept for robustness on
            // slower devices). Fill the rest randomly so the sector's mine
            // count is always exactly right, even if the guess-free
            // guarantee can't be for this one board.
            if (best.placed < mineCount) {
                const remainingCandidates = candidates.filter((idx) => !best.mines[idx]);
                shuffleInPlace(remainingCandidates);
                for (let k = 0; best.placed < mineCount && k < remainingCandidates.length; k++) {
                    best.mines[remainingCandidates[k]] = 1;
                    best.placed++;
                }
            }
            return best.mines;
        }

        function placeMines(safeX, safeY) {
            const mines = generateNoGuessBoard(MINES_COUNT, safeX, safeY);
            for (let i = 0; i < GRID_SIZE; i++) {
                for (let j = 0; j < GRID_SIZE; j++) {
                    gridData[i][j].isMine = !!mines[i * GRID_SIZE + j];
                }
            }

            for(let i = 0; i < GRID_SIZE; i++) {
                for(let j = 0; j < GRID_SIZE; j++) {
                    if(!gridData[i][j].isMine) {
                        let count = 0;
                        for(let dx = -1; dx <= 1; dx++) {
                            for(let dy = -1; dy <= 1; dy++) {
                                let nx = i + dx, ny = j + dy;
                                if(nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE && gridData[nx][ny].isMine) count++;
                            }
                        }
                        gridData[i][j].adjacent = count;
                    }
                }
            }
        }

        function applySearchAlgo() {
            if (gameMode !== 'roguelike') return;
            const amount = OPERATOR_DATA.upgrades.searchAlgo;
            if (amount === 0) return;

            let found = 0;
            const maxFind = Math.min(amount, 4, Math.max(1, Math.floor(MINES_COUNT * 0.18)));
            let attempts = 0;
            while(found < maxFind && attempts < 1000) {
                let x = Math.floor(Math.random() * GRID_SIZE);
                let y = Math.floor(Math.random() * GRID_SIZE);
                if(gridData[x][y].isMine && !gridData[x][y].flagged && !gridData[x][y].revealed) {
                    toggleFlag(x * GRID_SIZE + y, x, y);
                    found++;
                }
                attempts++;
            }
        }

        function applyScoutNextSector() {
            if (!scoutNextSector || gameMode !== 'roguelike') return;
            let remaining = scoutNextSector;
            scoutNextSector = 0;
            let attempts = 0;
            while(remaining > 0 && attempts < 2000) {
                const x = Math.floor(Math.random() * GRID_SIZE);
                const y = Math.floor(Math.random() * GRID_SIZE);
                if(gridData[x][y].isMine && !gridData[x][y].flagged && !gridData[x][y].revealed) {
                    toggleFlag(x * GRID_SIZE + y, x, y);
                    remaining--;
                }
                attempts++;
            }
        }

        // ============================================================================

        // ============================================================================
        function advanceToNextSector() {
            const currentFocus = focus; // Salva o Focus atual do jogador
            const sectorPlan = getSectorPlan(currentSector);
            MINES_COUNT = sectorPlan.mines;
            sectorDrainMultiplier = sectorPlan.drain;
            if (pendingRouteChoice === 'resupply') sectorDrainMultiplier = Math.max(0.85, sectorDrainMultiplier - 0.12);
            if (MINES_COUNT > 45) MINES_COUNT = 45; // Maximum mine limit (45%)

            firstClick = true;
            gameOver = false;
            timer = 0;
            uiTimer.innerText = '000';

            flagsPlaced = 0;
            cellsRevealed = 0;
            flagsMap.clear();
            minesDisplay.innerText = (MINES_COUNT - flagsPlaced).toString().padStart(3, '0');

            uiFocus.classList.remove('text-emerald-400');
            uiFocus.innerText = `F:${formatFocus(currentFocus)}%`;
            uiSector.innerText = getSectorHudLabel(currentSector);
            focus = currentFocus;

            sectorScanUsed = false;
            sectorMineHits = 0;

            while(spritesGroup.children.length > 0){
                spritesGroup.remove(spritesGroup.children[0]);
            }
            clearTacticalNumberBillboards();
            for(let i = 0; i < GRID_SIZE; i++) {
                for(let j = 0; j < GRID_SIZE; j++) {
                    gridData[i][j] = { isMine: false, revealed: false, flagged: false, adjacent: 0 };
                    const index = i * GRID_SIZE + j;
                    const state = cellStates[index];
                    gsap.killTweensOf(state);
                    state.y = 0;
                    state.scaleY = 1;
                    state.color.set(activeColors.hiddenTop);
                    applyInstanceTransform(index, i - offset, j - offset);
                }
            }


            camera.position.set(0, 25, 3.5);
            gsap.to(camera.position, { x: 0, y: 10, z: 3.5, duration: 1.5, ease: "power2.out" });
            if (gameMode === 'roguelike') sfx.descend.play();
            pendingRouteChoice = 'advance';
        }

        function resetRoom({ preserveFocus = false } = {}) {
            firstClick = true;
            gameOver = false;
            timer = 0;
            clearInterval(timerInterval);
            clearInterval(rogueliteTimer);
            uiTimer.innerText = '000';

            // Reset the operator portrait state for the new run.
            isDead = false;
            isDamaged = false;
            lastInteractionTime = performance.now();
            gsap.killTweensOf(uiSmileyImg);
            uiSmileyImg.style.transform = 'scale(1)';
            currentSmileySrc = getOperatorImages().active;
            uiSmileyImg.src = currentSmileySrc;
            uiSmiley.style.backgroundImage = '';
            gsap.killTweensOf('#death-overlay');
            document.getElementById('death-overlay').style.opacity = '0';
            uiFocus.classList.remove('text-emerald-400');
            uiFocus.classList.remove('text-red-700');

            if (gameMode === 'classic') {
                focus = 100;
                uiFocus.classList.add('hidden');
                uiSector.classList.add('hidden');
                operationActive = false;
            } else {
                const maxFocus = getMaxFocus();
                // A restart rerolls the board, not the pressure: only a fresh
                // campaign starts at full focus.
                focus = preserveFocus ? Math.min(maxFocus, focus) : maxFocus;
                uiFocus.classList.remove('hidden');
                uiSector.classList.remove('hidden');
                uiSector.innerText = getSectorHudLabel(currentSector);
                operationActive = true;
                sectorScanUsed = false;
                sectorMineHits = 0;
            }
            uiFocus.innerText = `F:${formatFocus(focus)}%`;

            uiFocus.classList.remove('text-red-600', 'animate-pulse');

            if (!sfx.wind.playing()) {
                sfx.wind.play();
            }

            flagsPlaced = 0;
            cellsRevealed = 0;
            flagsMap.clear();
            minesDisplay.innerText = (MINES_COUNT - flagsPlaced).toString().padStart(3, '0');

            activeColors = gameMode === 'classic' ? CLASSIC_COLORS : TACTICAL_COLORS;

            while(spritesGroup.children.length > 0){
                const child = spritesGroup.children[0];
                child.traverse((node) => {
                    if (node.geometry && node.geometry.userData?.isDisposable) {
                        node.geometry.dispose();
                    }
                });
                spritesGroup.remove(child);
            }
            clearTacticalNumberBillboards();
            for(let i = 0; i < GRID_SIZE; i++) {
                for(let j = 0; j < GRID_SIZE; j++) {
                    gridData[i][j] = { isMine: false, revealed: false, flagged: false, adjacent: 0 };
                    const index = i * GRID_SIZE + j;
                    const state = cellStates[index];
                    gsap.killTweensOf(state);
                    state.y = 0;
                    state.scaleY = 1;
                    state.color.set(activeColors.hiddenTop);
                    applyInstanceTransform(index, i - offset, j - offset);
                }
            }


            gsap.killTweensOf(camera);
            gsap.killTweensOf(camera.position);
            gsap.to(camera, { zoom: 1, duration: 0.8, ease: "power2.out", onUpdate: () => camera.updateProjectionMatrix() });
            gsap.to(camera.position, { x: 0, y: 10, z: 3.5, duration: 0.8, ease: "power2.out" });
        }

        function startRoom(mines, mode) {
            gameMode = mode;
            MINES_COUNT = mode === 'roguelike' ? getSectorPlan(1).mines : mines;
            setModeClass(mode);
            updateDustAtmosphere();
            currentSector = 1; // Resets the sector when starting a new campaign
            fragmentsCollected = 0;
            scoutNextSector = 0;
            pendingSectorReward = 0;
            pendingRouteChoice = 'advance';
            sectorDrainMultiplier = getSectorPlan(1).drain;
            sectorScanUsed = false;
            sectorMineHits = 0;
            transitionTo(null, () => {
                resetRoom();
            });
        }

        // ============================================================================

        // ============================================================================
        function triggerSonar() {
            if (gameMode !== 'roguelike' || !operationActive || gameOver || isDead) return;
            signalOperatorActivity(1.25);
            const scanButton = document.getElementById('scan-button');
            const baseCost = gadgets.sonar.cost;
            const discount = OPERATOR_DATA.upgrades.neuralSync * UPGRADE_RULES.neuralSync.sonarDiscount;
            const sectorOneFirstScan = currentSector === 1 && !sectorScanUsed;
            const finalCost = Math.max(5, baseCost - discount);

            if (focus < finalCost) {
                sfx.error.play();
                showFieldNotice('Not enough focus to activate SCAN.', 'danger');
                return;
            }

            // Gasta Focus
            const effectiveCost = sectorOneFirstScan ? Math.max(5, finalCost - 7) : Math.max(7, finalCost);
            if (focus < effectiveCost) {
                sfx.error.play();
                showFieldNotice('Not enough focus to activate SCAN.', 'danger');
                return;
            }
            // Tiles the sonar has already cleared are out: every scan has to
            // buy new ground, not repeat what the player was told before.
            const safeTiles = [];
            for(let i = 0; i < GRID_SIZE; i++) {
                for(let j = 0; j < GRID_SIZE; j++) {
                    const cell = gridData[i][j];
                    if(!cell.isMine && !cell.revealed && !cell.flagged && !cell.scanned) {
                        safeTiles.push({ i, j });
                    }
                }
            }

            if(safeTiles.length === 0) {
                sfx.error.play();
                showFieldNotice('Sonar has nothing new: every reachable safe tile is already marked.', 'neutral');
                return;
            }

            focus -= effectiveCost;
            sectorScanUsed = true;
            uiFocus.innerText = `F:${formatFocus(focus)}%`;
            if (focus <= 20) uiFocus.classList.add('text-red-500', 'animate-pulse');
            else uiFocus.classList.remove('text-red-500', 'animate-pulse');
            sfx.sonar.play();
            scanButton.classList.remove('is-scanning');
            void scanButton.offsetWidth;
            scanButton.classList.add('is-scanning');
            gsap.fromTo(scanButton, { boxShadow: '0 0 0 0 rgba(145,240,185,0.65)' }, { boxShadow: '0 0 0 16px rgba(145,240,185,0)', duration: 0.7, ease: 'power2.out' });

            const pulseCount = Math.min(10 + OPERATOR_DATA.upgrades.neuralSync * 2, safeTiles.length);
            const scannedColor = new THREE.Color(activeColors.scanned);
            safeTiles.sort(() => Math.random() - 0.5).slice(0, pulseCount).forEach(({ i, j }, pulseIndex) => {
                const idx = i * GRID_SIZE + j;
                const v = cellStates[idx];
                const px = i - offset;
                const pz = j - offset;

                // The pulse settles on the cleared colour and stays there. It
                // used to revert, which made the player memorise the flash
                // instead of reading the board.
                gridData[i][j].scanned = true;
                gsap.to(v.color, { r: 0.76, g: 0.88, b: 0.95, duration: 0.38, yoyo: true, repeat: 3, repeatDelay: 0.08, delay: pulseIndex * 0.018,
                    onUpdate: () => applyInstanceTransform(idx, px, pz),
                    onComplete: () => { v.color.copy(scannedColor); applyInstanceTransform(idx, px, pz); }
                });
            });
            showFieldNotice(`${sectorOneFirstScan ? 'Training SCAN' : 'SCAN'} marked ${pulseCount} tiles as clear. Focus -${effectiveCost}.`, 'neutral');
        }

        // ============================================================================

        // ============================================================================
        function startRogueliteMechanics() {

            if (gameMode !== 'roguelike') return;

            // Passive focus drain from operator stress
            rogueliteTimer = setInterval(() => {
                if (gameOver || isDead) return;

                focus = Math.max(0, focus - sectorDrainMultiplier); // Loses focus from sector pressure
                uiFocus.innerText = `F:${formatFocus(focus)}%`;


                if (focus <= 20) {
                    uiFocus.classList.add('text-red-500', 'animate-pulse');
                    gsap.fromTo('#death-overlay', { opacity: 0.2 }, { opacity: 0, duration: 0.8 }); // Tela palpita vermelho
                }


                if (focus <= 0) {
                    focus = 0;
                    uiFocus.innerText = `F:0%`;
                    triggerRogueliteDeathExhaustion();
                }
            }, 1000);
        }

        function startActiveTimers() {
            clearInterval(timerInterval);
            clearInterval(rogueliteTimer);
            timerInterval = setInterval(() => {
                timer++;
                uiTimer.innerText = timer.toString().padStart(3, '0');
            }, 1000);

            if (gameMode === 'roguelike') {
                startRogueliteMechanics();
            }
        }

        function triggerRogueliteDeathExhaustion() {
            gameOver = true;
            isDead = true;
            clearInterval(timerInterval);
            clearInterval(rogueliteTimer);

            const reward = Math.round(getSectorPlan(currentSector).reward * 0.35);
            OPERATOR_DATA.totalFragments += reward;
            OPERATOR_DATA.save();
            updateSaveSummary();
            setTimeout(() => {
                openReport({
                    title: 'SIGNAL LOST',
                    copy: `You blacked out in sector ${currentSector}. We recovered what we could. Stand up and learn.`,
                    earned: reward
                });
            }, 3200);

            uiSmileyImg.src = getOperatorImages().death;
            gsap.to('#death-overlay', { opacity: 0.8, duration: 2 });


            gsap.to(camera, { zoom: 2.2, duration: 3, ease: "power2.inOut", onUpdate: () => camera.updateProjectionMatrix() });

            // Passively reveals all mines
            for(let i = 0; i < GRID_SIZE; i++) {
                for(let j = 0; j < GRID_SIZE; j++) {
                    if(gridData[i][j].isMine && !gridData[i][j].flagged) {
                        const idx = i * GRID_SIZE + j;
                        const v2 = cellStates[idx];
                        const px2 = i - offset;
                        const pz2 = j - offset;

                        gsap.to(v2, {
                            y: gameMode === 'classic' ? -0.12 : -0.18, scaleY: gameMode === 'classic' ? 0.6 : 0.8, delay: Math.random() * 2, duration: 0.4, ease: "power2.inOut",
                            onUpdate: () => {
                                v2.color.lerp(new THREE.Color(activeColors.revealed), 0.2);
                                applyInstanceTransform(idx, px2, pz2);
                            },
                            onComplete: () => {
                                v2.color.copy(new THREE.Color(activeColors.revealed));
                                applyInstanceTransform(idx, px2, pz2);
                                const otherBomb = gameMode === 'classic' ? createClassicBombMesh(false) : createTacticalBombMesh(false);
                                otherBomb.position.set(px2, -0.5, pz2);
                                spritesGroup.add(otherBomb);
                                gsap.to(otherBomb.position, { y: 0.1, duration: 0.5, ease: "back.out(1.5)" });
                            }
                        });
                    }
                }
            }
        }
        // ============================================================================


        function triggerHudGlitch() {
            const hud = document.getElementById('ui-layer');
            gsap.killTweensOf(hud);
            gsap.killTweensOf('#focus-display');
            gsap.fromTo(hud,
                { x: -4, filter: 'contrast(1.35) saturate(1.25)' },
                { x: 4, filter: 'contrast(1) saturate(1)', duration: 0.055, repeat: 7, yoyo: true, ease: 'steps(2)', clearProps: 'transform,filter' }
            );
            gsap.fromTo('#focus-display',
                { scale: 1.08 },
                { scale: 1, duration: 0.12, repeat: 2, yoyo: true, ease: 'power1.inOut', clearProps: 'transform' }
            );
        }

        const CLASSIC_COLORS = {
            hiddenTop: '#94a3b8', revealed: '#e7e5e4', mine: '#222222', scanned: '#8fb3a1',
            numbers: ['#000000','#2563eb','#16a34a','#dc2626','#9333ea','#ca8a04','#0d9488','#ea580c','#475569']
        };
        const TACTICAL_COLORS = {
            hiddenTop: '#5a5e53',
            scanned: '#7fa98a',   // Sonar-cleared ground: still covered, but read
            revealed: '#3d3f38',  // Exposed soil / compacted dirt
            mine: '#1a1a1a',      // Metal escuro industrial
            numbers: ['#f8fafc','#7fb2ff','#8bd27f','#e05f4f','#b884ff','#d5aa4c','#5fc5b5','#f08a45','#d8d2b0']
        };
        let activeColors = CLASSIC_COLORS;


        function createSprite(text, color='#000', size=128) {
            const can = document.createElement('canvas');
            can.width = can.height = size;
            const ctx = can.getContext('2d');

            ctx.clearRect(0,0,size,size);

            if (gameMode === 'classic') {

                ctx.font = `400 ${Math.floor(size*.65)}px 'Black Ops One'`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = color;
                ctx.fillText(text, size/2, size/2+4);
            } else {

                ctx.font = `900 ${Math.floor(size*.72)}px 'Black Ops One', Impact, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = 'rgba(8, 8, 7, 0.78)';
                ctx.beginPath();
                ctx.ellipse(size / 2, size / 2 + 6, size * 0.34, size * 0.26, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(214, 194, 122, 0.34)';
                ctx.lineWidth = Math.max(3, size * 0.025);
                ctx.stroke();
                ctx.lineWidth = Math.max(8, size * 0.07);
                ctx.strokeStyle = 'rgba(0,0,0,0.9)';
                ctx.strokeText(text, size/2, size/2 + 3);
                ctx.fillStyle = color;
                ctx.fillText(text, size/2, size/2 + 3);
            }

            const tex = new THREE.CanvasTexture(can);
            tex.minFilter = THREE.LinearFilter;
            tex.needsUpdate = true;

        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, toneMapped: false });
        const s = new THREE.Sprite(mat);
        s.scale.set(0.68, 0.68, 0.68);
        s.renderOrder = 9000;
        s.frustumCulled = false;
        s.layers.enable(0);
        s.layers.enable(1);
        return s;
        }

        const tacticalNumberBillboards = [];

        function clearTacticalNumberBillboards() {
            tacticalNumberBillboards.length = 0;
        }

        function createTacticalNumberMesh(value, color) {
            const size = 128;
            const can = document.createElement('canvas');
            can.width = can.height = size;
            const ctx = can.getContext('2d');

            ctx.clearRect(0, 0, size, size);
            ctx.fillStyle = 'rgba(6, 6, 4, 0.58)';
            ctx.fillRect(28, 20, 72, 88);
            ctx.font = `400 78px 'Black Ops One', Impact, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineWidth = 8;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.88)';
            ctx.strokeText(value.toString(), size / 2, size / 2 + 4);
            ctx.fillStyle = color;
            ctx.fillText(value.toString(), size / 2, size / 2 + 4);

            const tex = new THREE.CanvasTexture(can);
            tex.minFilter = THREE.LinearFilter;
            tex.needsUpdate = true;
            const mat = new THREE.SpriteMaterial({
                map: tex,
                transparent: true,
                depthWrite: false,
                depthTest: false,
                toneMapped: false
            });
            const sprite = new THREE.Sprite(mat);
            sprite.scale.set(0.52, 0.52, 0.52);
            sprite.renderOrder = 12000;
            sprite.frustumCulled = false;
            sprite.layers.enable(0);
            sprite.layers.enable(1);
            tacticalNumberBillboards.push(sprite);
            return sprite;
        }

        function showRogueliteNumber(cell, px, pz) {
            if (cell.isMine || cell.adjacent <= 0 || cell.numberMesh) return;
            const numberMesh = createTacticalNumberMesh(cell.adjacent, activeColors.numbers[cell.adjacent]);
            numberMesh.position.set(px, 0.16, pz);
            spritesGroup.add(numberMesh);
            cell.numberMesh = numberMesh;
            gsap.from(numberMesh.scale, { x: 0, y: 0, z: 0, duration: 0.28, ease: "back.out(1.5)" });
        }


        const canvasNoise = document.createElement('canvas');
        canvasNoise.width = 256; canvasNoise.height = 256;
        const ctxNoise = canvasNoise.getContext('2d');
        ctxNoise.fillStyle = '#ffffff'; ctxNoise.fillRect(0,0,256,256);
        for(let i=0; i<12000; i++) {
            ctxNoise.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.18)'; // Opacidade e contraste aumentados
            ctxNoise.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
        }
        const texNoise = new THREE.CanvasTexture(canvasNoise);
        texNoise.wrapS = texNoise.wrapT = THREE.RepeatWrapping;


        const uiNoiseCan = document.createElement('canvas');
        uiNoiseCan.width = 256; uiNoiseCan.height = 256;
        const uiCtx = uiNoiseCan.getContext('2d');
        for(let i=0; i<15000; i++) {
            uiCtx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.4)';
            uiCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
        }
        document.documentElement.style.setProperty('--ui-noise', `url(${uiNoiseCan.toDataURL()})`);


        const SHARED_FLAG_BASE_MAT = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.7 });
        const SHARED_FLAG_BASE_BOTTOM_GEO = new THREE.CylinderGeometry(0.12, 0.16, 0.04, 16);
        const SHARED_FLAG_BASE_TOP_GEO = new THREE.CylinderGeometry(0.08, 0.11, 0.04, 16);
        const SHARED_FLAG_POLE_MAT = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 });
        const SHARED_FLAG_POLE_GEO = new THREE.CylinderGeometry(0.021, 0.021, 0.4);
        const SHARED_FLAG_FABRIC_MAT = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 });


        function createClassicFlagMesh() {
            const group = new THREE.Group();
            const baseBottom = new THREE.Mesh(SHARED_FLAG_BASE_BOTTOM_GEO, SHARED_FLAG_BASE_MAT);
            baseBottom.position.y = 0.02;
            baseBottom.castShadow = true;
            const baseTop = new THREE.Mesh(SHARED_FLAG_BASE_TOP_GEO, SHARED_FLAG_BASE_MAT);
            baseTop.position.y = 0.06;
            baseTop.castShadow = true;

            const pole = new THREE.Mesh(SHARED_FLAG_POLE_GEO, SHARED_FLAG_POLE_MAT);
            pole.position.y = 0.2;
            pole.castShadow = true;

            const flagGeo = new THREE.BoxGeometry(0.2, 0.15, 0.04, 6, 2, 1);
            flagGeo.userData = { isDisposable: true };
            flagGeo.translate(0.1, 0, 0);
            const pos = flagGeo.attributes.position;
            const baseZ = new Float32Array(pos.count);
            for(let i = 0; i < pos.count; i++) {
                const x = pos.getX(i);
                pos.setY(i, pos.getY(i) * (1 - (x / 0.2)));
                baseZ[i] = pos.getZ(i);
            }
            flagGeo.setAttribute('baseZ', new THREE.BufferAttribute(baseZ, 1));
            flagGeo.computeVertexNormals();
            const flag = new THREE.Mesh(flagGeo, SHARED_FLAG_FABRIC_MAT);
            flag.position.set(0, 0.3, 0);
            flag.castShadow = true;
            group.add(baseBottom, baseTop, pole, flag);
            return group;
        }


        function createTacticalMarkerMesh() {
            const group = new THREE.Group();


            const baseBottom = new THREE.Mesh(SHARED_FLAG_BASE_BOTTOM_GEO, SHARED_FLAG_BASE_MAT);
            baseBottom.position.y = 0.02;
            baseBottom.castShadow = true;
            const baseTop = new THREE.Mesh(SHARED_FLAG_BASE_TOP_GEO, SHARED_FLAG_BASE_MAT);
            baseTop.position.y = 0.06;
            baseTop.castShadow = true;

            const pole = new THREE.Mesh(SHARED_FLAG_POLE_GEO, SHARED_FLAG_POLE_MAT);
            pole.position.y = 0.2;
            pole.castShadow = true; // Sombra do mastro

            // Trocado de PlaneGeometry para BoxGeometry para dar espessura (Estilo Toy 3D)
            const flagGeo = new THREE.BoxGeometry(0.2, 0.15, 0.04, 6, 2, 1);
            flagGeo.userData = { isDisposable: true };
            flagGeo.translate(0.1, 0, 0); // Desloca o eixo para fixar a base no mastro


            const pos = flagGeo.attributes.position;
            const baseZ = new Float32Array(pos.count); // Array para guardar a profundidade (espessura) original
            for(let i = 0; i < pos.count; i++) {
                const x = pos.getX(i);
                pos.setY(i, pos.getY(i) * (1 - (x / 0.2))); // Afunila o Y conforme afasta do mastro
                baseZ[i] = pos.getZ(i);
            }
            flagGeo.setAttribute('baseZ', new THREE.BufferAttribute(baseZ, 1));
            flagGeo.computeVertexNormals();


            const flag = new THREE.Mesh(flagGeo, SHARED_FLAG_FABRIC_MAT);
            flag.position.set(0, 0.3, 0);
            flag.castShadow = true; // Sombra do tecido espesso
            group.add(baseBottom, baseTop, pole, flag);
            return group;
        }

        function toggleFlag(instanceId, x, y) {
            const cell = gridData[x][y];
            if (cell.revealed) return;

            if (cell.flagged) {
                cell.flagged = false;
                const flag = flagsMap.get(instanceId);
                if (flag) {
                    gsap.to(flag.scale, { x: 0, y: 0, z: 0, duration: 0.2, onComplete: () => {
                        flag.traverse((node) => {
                            if (node.geometry && node.geometry.userData?.isDisposable) node.geometry.dispose();
                        });
                        spritesGroup.remove(flag);
                        flagsMap.delete(instanceId);
                    }});
                }
                flagsPlaced--;
                if (gameMode === 'roguelike') {
                    sfx.unmarker.play();
                }
            } else {
                cell.flagged = true;
                const flag = gameMode === 'classic' ? createClassicFlagMesh() : createTacticalMarkerMesh();
                const px = x - offset;
                const pz = y - offset;
                flag.position.set(px, 0.18, pz); // Fica fincada no topo do bloco
                flag.scale.set(0, 0, 0);
                spritesGroup.add(flag);
                flagsMap.set(instanceId, flag);
                gsap.to(flag.scale, { x: 1.6, y: 1.6, z: 1.6, duration: 0.4, ease: "back.out(2)" }); // Aumento de 60%
                flagsPlaced++;
                if (gameMode === 'roguelike') {
                    sfx.marker.play();
                }
            }
            minesDisplay.innerText = (MINES_COUNT - flagsPlaced).toString().padStart(3, '0');
        }


        const SHARED_PARTICLE_GEO = new THREE.TetrahedronGeometry(0.08, 0);
        const SHARED_PARTICLE_MAT = new THREE.MeshBasicMaterial({ color: 0xff7700 });
        const SHARED_SMOKE_GEO = new THREE.SphereGeometry(0.15, 8, 8);
        const SHARED_DEBRIS_GEO = new THREE.BoxGeometry(0.2, 0.2, 0.2);

        const SHARED_BOMB_BODY_FATAL = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x330000, emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.8 });
        const SHARED_BOMB_BODY_SAFE = new THREE.MeshStandardMaterial({ color: 0x666666, emissive: 0x222222, emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.8 });
        const SHARED_BOMB_SPIKE = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1.0, roughness: 0.2 });
        const SHARED_BOMB_BODY_GEO = new THREE.SphereGeometry(0.22, 16, 16);
        const SHARED_BOMB_SPIKE_GEO = new THREE.ConeGeometry(0.04, 0.12, 8);
        SHARED_BOMB_SPIKE_GEO.translate(0, 0.06, 0);

        const SHARED_TAC_BOMB_BODY_FATAL = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.3 });
        const SHARED_TAC_BOMB_BODY_SAFE = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.4, roughness: 0.3 });
        const SHARED_TAC_BOMB_BODY_GEO = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 16);
        const SHARED_TAC_BOMB_TOP_MAT = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const SHARED_TAC_BOMB_TOP_GEO = new THREE.CylinderGeometry(0.08, 0.08, 0.05, 8);


        function createClassicBombMesh(isFatal = true) {
            const group = new THREE.Group();
            group.scale.setScalar(1.2);
            const bodyMat = isFatal ? SHARED_BOMB_BODY_FATAL : SHARED_BOMB_BODY_SAFE;
            const body = new THREE.Mesh(SHARED_BOMB_BODY_GEO, bodyMat);
            group.add(body);
            const dirs = [
                new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0), new THREE.Vector3(0,1,0), new THREE.Vector3(0,-1,0), new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1),
                new THREE.Vector3(1,1,1).normalize(), new THREE.Vector3(-1,1,1).normalize(), new THREE.Vector3(1,-1,1).normalize(), new THREE.Vector3(-1,-1,1).normalize(),
                new THREE.Vector3(1,1,-1).normalize(), new THREE.Vector3(-1,1,-1).normalize(), new THREE.Vector3(1,-1,-1).normalize(), new THREE.Vector3(-1,-1,-1).normalize()
            ];
            dirs.forEach(dir => {
                const spike = new THREE.Mesh(SHARED_BOMB_SPIKE_GEO, SHARED_BOMB_SPIKE);
                spike.position.copy(dir).multiplyScalar(0.19);
                spike.lookAt(dir.clone().multiplyScalar(2));
                spike.rotateX(Math.PI / 2);
                group.add(spike);
            });
            const light = new THREE.PointLight(isFatal ? 0xff0000 : 0xffffff, isFatal ? 15 : 2, 3);
            light.position.y = 0.1;
            group.add(light);
            return group;
        }


        function createTacticalBombMesh(isFatal = true) {
            const group = new THREE.Group();
            group.scale.setScalar(1.2);

            // Corpo: Cilindro achatado (estilo mina antipessoal moderna)
            const bodyMat = isFatal ? SHARED_TAC_BOMB_BODY_FATAL : SHARED_TAC_BOMB_BODY_SAFE;
            const body = new THREE.Mesh(SHARED_TAC_BOMB_BODY_GEO, bodyMat);
            group.add(body);


            const top = new THREE.Mesh(SHARED_TAC_BOMB_TOP_GEO, SHARED_TAC_BOMB_TOP_MAT);
            top.position.y = 0.05;
            group.add(top);

            if (isFatal) {

                const light = new THREE.PointLight(0xff0000, 10, 6);
                light.position.y = 0.05;
                group.add(light);
            } else {

                group.traverse(child => {
                    if (child.isMesh) child.layers.set(1);
                });
            }
            return group;
        }

        function triggerExplosion(x, y, z) {

            const emberCount = compactViewport ? 10 : 16;
            const smokeCount = compactViewport ? 5 : 7;
            const debrisCount = compactViewport ? 8 : 12;

            for(let i=0; i<emberCount; i++) {
                const mesh = new THREE.Mesh(SHARED_PARTICLE_GEO, SHARED_PARTICLE_MAT);
                mesh.scale.set(0, 0, 0);
                spritesGroup.add(mesh); // Grupo limpa automaticamente no resetRoom
                let emberLoops = 0;

                const floatEmber = () => {
                    if (emberLoops++ > 4) {
                        spritesGroup.remove(mesh);
                        return;
                    }
                    if (!spritesGroup.children.includes(mesh)) return;


                    const startX = x + (Math.random() - 0.5) * 2.8;
                    const startZ = z + (Math.random() - 0.5) * 2.8;
                    mesh.position.set(startX, y - 0.1, startZ);
                    mesh.scale.setScalar(Math.random() * 0.4 + 0.2); // Tamanhos irregulares

                    const duration = 2 + Math.random() * 3; // Flutua lentamente (de 2s a 5s)

                    // Movimento lento para cima e levemente para os lados
                    gsap.to(mesh.position, {
                        x: startX + (Math.random() - 0.5) * 1.5,
                        y: y + 0.2 + Math.random() * 1.5,
                        z: startZ + (Math.random() - 0.5) * 1.5,
                        duration: duration,
                        ease: "sine.inOut"
                    });


                    gsap.to(mesh.rotation, { x: Math.random() * 10, y: Math.random() * 10, duration: duration, ease: "none" });
                    gsap.to(mesh.scale, { x: 0, y: 0, z: 0, duration: duration * 0.5, delay: duration * 0.5, ease: "power2.inOut", onComplete: floatEmber });
                };


                gsap.delayedCall(Math.random() * 2, floatEmber);
            }


            for(let i=0; i<smokeCount; i++) {
                const smokeMat = new THREE.MeshLambertMaterial({ color: 0x333333, transparent: true, opacity: 0.9 });
                const smoke = new THREE.Mesh(SHARED_SMOKE_GEO, smokeMat);
                smoke.position.set(x + (Math.random()-0.5)*0.4, y, z + (Math.random()-0.5)*0.4);
                spritesGroup.add(smoke);

                const duration = 1.5 + Math.random() * 1.5;
                gsap.to(smoke.position, {
                    y: y + 1.5 + Math.random() * 2,
                    x: x + (Math.random() - 0.5) * 1.5,
                    duration: duration,
                    ease: "power1.out",
                    delay: 0.1
                });
                gsap.to(smoke.scale, { x: 3, y: 3, z: 3, duration: duration, ease: "power2.out", delay: 0.1 });
                gsap.to(smokeMat, {
                    opacity: 0,
                    duration: duration * 0.7,
                    delay: duration * 0.3,
                    onComplete: () => {
                        spritesGroup.remove(smoke);
                        smokeMat.dispose();
                    }
                });
            }


            for(let i = 0; i < debrisCount; i++) {
                const debrisMat = new THREE.MeshLambertMaterial({
                    color: activeColors.hiddenTop,
                    transparent: true
                });
                const debris = new THREE.Mesh(SHARED_DEBRIS_GEO, debrisMat);
                debris.castShadow = quality.shadows;


                debris.scale.setScalar(0.5 + Math.random());
                debris.position.set(x + (Math.random()-0.5)*0.5, y + 0.2, z + (Math.random()-0.5)*0.5);
                spritesGroup.add(debris);

                const angle = Math.random() * Math.PI * 2;
                const radius = 1.5 + Math.random() * 3;
                const flightDuration = 0.5 + Math.random() * 0.4;


                gsap.to(debris.position, { x: x + Math.cos(angle) * radius, z: z + Math.sin(angle) * radius, duration: flightDuration, ease: "power2.out" });


                gsap.to(debris.position, { y: y + 1.5 + Math.random() * 2, duration: flightDuration / 2, ease: "power1.out", yoyo: true, repeat: 1 });


                gsap.to(debris.rotation, { x: Math.random() * 15, y: Math.random() * 15, z: Math.random() * 15, duration: flightDuration, ease: "none" });


                const delayBlink = flightDuration + 2 + Math.random() * 1.5;
                gsap.to(debrisMat, {
                    opacity: 0,
                    duration: 0.1,
                    yoyo: true,
                    repeat: 9,
                    delay: delayBlink,
                    ease: "power1.inOut",
                    onComplete: () => {
                        spritesGroup.remove(debris);
                        debrisMat.dispose();
                    }
                });
            }
        }

        // Three.js Setup
        const canvas = document.getElementById('game-canvas');
        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#37382a');
        scene.fog = new THREE.FogExp2('#37382a', 0.04); // Atmosfera densa e opressiva


        function getViewportSize() {
            const viewport = window.visualViewport;
            return {
                width: Math.max(1, Math.round(viewport?.width || window.innerWidth || document.documentElement.clientWidth || 1)),
                height: Math.max(1, Math.round(viewport?.height || window.innerHeight || document.documentElement.clientHeight || 1))
            };
        }

        function syncAppHeightVar() {
            const { height } = getViewportSize();
            document.documentElement.style.setProperty('--app-height', `${height}px`);
        }

        function getPlayViewport() {
            syncAppHeightVar();
            const viewportSize = getViewportSize();
            if (getEffectiveLandscapeLayout()) {
                const rootStyle = getComputedStyle(document.documentElement);
                const sideHud = parseFloat(rootStyle.getPropertyValue('--hud-side')) || 0;
                const fieldShift = parseFloat(rootStyle.getPropertyValue('--field-shift')) || 0;
                return {
                    top: 0,
                    width: Math.max(260, viewportSize.width - sideHud + fieldShift),
                    height: viewportSize.height
                };
            }
            const uiLayer = document.getElementById('ui-layer');
            // Measure the HUD itself. Reading the canvas margin instead would
            // feed syncCanvasSize its own previous output back, so the reserved
            // strip could only ever grow (a 175px desktop HUD stayed 175px
            // after shrinking to a 139px phone HUD).
            const hudSafe = uiLayer?.getBoundingClientRect().height || 0;
            // The action bar takes real space: leave it out of the play area or
            // it covers the bottom of the board.
            const barVisible = actionBar && getComputedStyle(actionBar).display !== 'none';
            const actionBarSafe = barVisible ? actionBar.getBoundingClientRect().height : 0;
            const canvasHeight = Math.max(260, viewportSize.height - hudSafe - actionBarSafe);
            return {
                top: hudSafe,
                width: viewportSize.width,
                height: canvasHeight
            };
        }

        const compactViewport = window.matchMedia('(max-width: 900px), (pointer: coarse)').matches;
        const isPhoneLikeViewport = () => {
            const { width, height } = getViewportSize();
            return Math.min(width, height) <= 760 && Math.max(width, height) <= 900;
        };
        const isPortraitViewport = () => {
            const { width, height } = getViewportSize();
            return height > width;
        };
        const syncViewportClass = () => {
            const portrait = isPortraitViewport();
            const mobileViewport = isPhoneLikeViewport();
            const effectivePortrait = mobileViewport ? getEffectivePortraitLayout() : portrait;
            const mobileLandscape = isPhoneLikeViewport() && !effectivePortrait;
            document.body.classList.toggle('is-portrait', effectivePortrait);
            document.body.classList.toggle('is-landscape', !effectivePortrait);
            document.body.classList.toggle('is-mobile-viewport', mobileViewport);
            document.body.classList.toggle('is-mobile-landscape', mobileLandscape);
            document.body.classList.toggle('layout-portrait-override', mobileViewport && mobileLayoutPreference === 'portrait');
            document.body.dataset.orientation = effectivePortrait ? 'portrait' : 'landscape';
            document.body.dataset.mobileViewport = String(mobileViewport);
            document.body.dataset.mobileOrientationBlocked = String(mobileLandscape);
            document.body.dataset.mobileLayoutPreference = mobileLayoutPreference;
            syncLayoutToggleLabel();
            syncActionBarSlots();
            if (gameMode === 'roguelike' && uiSector && !uiSector.classList.contains('hidden')) {
                uiSector.innerText = getSectorHudLabel(currentSector);
            }
        };
        syncViewportClass();
        let playViewport = getPlayViewport();
        const aspect = playViewport.width / playViewport.height;
        const baseFrustumSize = GRID_SIZE + (compactViewport ? 6.5 : 5.25);
        function getFrustumSize(aspectRatio) {
            const portrait = isPortraitViewport();
            const phoneLandscape = getEffectiveLandscapeLayout();
            const boardSafeWidth = GRID_SIZE + (compactViewport
                ? (phoneLandscape ? 1.05 : portrait ? 0.65 : 2.2)
                : 1.6);
            const boardSafeHeight = GRID_SIZE + (compactViewport
                ? (phoneLandscape ? 1.65 : portrait ? 3.5 : 6.2)
                : 5.2);
            const portraitScale = portrait ? 1 : 1;
            const widthFit = boardSafeWidth / Math.max(aspectRatio, 0.1);
            const mobilePortraitFit = compactViewport && (portrait || phoneLandscape)
                ? Math.max(widthFit, boardSafeHeight)
                : Math.max(baseFrustumSize, widthFit, boardSafeHeight);
            return mobilePortraitFit * portraitScale;
        }
        let frustumSize = getFrustumSize(aspect);
        const camera = new THREE.OrthographicCamera(
            frustumSize * aspect / -2, frustumSize * aspect / 2,
            frustumSize / 2, frustumSize / -2,
            -20, 20
        );
        camera.position.set(0, 10, 3.5);
        camera.lookAt(0, -1, 0);
        camera.layers.enable(1); // Allows the camera to see Layer 1 (inactive mines)

        const quality = {
            pixelRatio: Math.min(window.devicePixelRatio || 1, compactViewport ? 1.05 : 1.25),
            shadows: false,
            bloom: false,
            dustCount: compactViewport ? 78 : 165,
            shadowMapSize: 512
        };

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
        const requestPortraitOrientation = () => {
            if (!isPhoneLikeViewport() || !screen.orientation?.lock) return;
            screen.orientation.lock('portrait-primary').catch(() => {});
        };
        function syncCanvasSize() {
            canvas.style.width = `${playViewport.width}px`;
            canvas.style.height = `${playViewport.height}px`;
            // pin the canvas to the measured HUD height: the CSS --hud-safe clamp
            // does not always match the rendered HUD, which left a dead strip at the bottom
            canvas.style.marginTop = getEffectiveLandscapeLayout() ? '0px' : `${playViewport.top}px`;
            renderer.setSize(playViewport.width, playViewport.height, false);
        }

        syncCanvasSize();
        renderer.setPixelRatio(quality.pixelRatio);
        renderer.shadowMap.enabled = quality.shadows;


        const useComposer = false;
        /*
        const composer = null;
        const bloomPass = null;
        bloomPass.threshold = 0.2;
        bloomPass.strength = 0.12; // Intensidade reduzida (brilho sutil)
        bloomPass.radius = 0.5;    // Espalhamento da luz
        if (quality.bloom) composer.addPass(bloomPass);
        const outputPass = new OutputPass();
        composer.addPass(outputPass);
        */


        const ambient = new THREE.AmbientLight(0xffffff, 0.3); // Luz ambiente baixa
        ambient.layers.enable(1);
        scene.add(ambient);

        const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
        sunLight.position.set(5, 10, 5);
        sunLight.castShadow = quality.shadows;
        sunLight.shadow.mapSize.width = quality.shadowMapSize; // Sombra suave
        sunLight.shadow.mapSize.height = quality.shadowMapSize;
        sunLight.shadow.camera.right = 12;
        sunLight.shadow.camera.top = 12;
        sunLight.shadow.camera.bottom = -12;
        sunLight.shadow.camera.near = 0.1;
        sunLight.shadow.camera.far = 30;
        sunLight.layers.enable(1);
        scene.add(sunLight);

        // Luz de preenchimento fria (Sombra azulada)
        const fillLight = new THREE.DirectionalLight(0x60a5fa, 0.8);
        fillLight.position.set(-5, 2, -5);
        scene.add(fillLight);


        const skyFillLight = new THREE.DirectionalLight(0x7dd3fc, 1.0);
        skyFillLight.position.set(0, 6, 2); // Luz suave vindo de cima/frente
        skyFillLight.layers.set(1); // APLICA APENAS NA LAYER 1 (Ignora os blocos normais)
        scene.add(skyFillLight);


        const dustAtmosphere = new THREE.Group();
        scene.add(dustAtmosphere);

        function createDustPoints(count, size, color, opacity) {
            const dustGeo = new THREE.BufferGeometry();
            const dustPos = new Float32Array(count * 3);
            for(let i = 0; i < count * 3; i++) {
                dustPos[i] = (Math.random() - 0.5) * 20;
            }
            dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
            const dustMat = new THREE.PointsMaterial({
                size,
                color,
                transparent: true,
                opacity,
                blending: THREE.AdditiveBlending
            });
            return new THREE.Points(dustGeo, dustMat);
        }

        const classicDustParticles = createDustPoints(quality.dustCount, 0.35, 0x94a3b8, 0.425);
        dustAtmosphere.add(classicDustParticles);

        const roguelikeDustParticles = [];
        const roguelikeDustCount = Math.floor(quality.dustCount * 0.5);
        const roguelikeDustSizes = [0.14, 0.22, 0.3, 0.39, 0.5];
        const roguelikeDustGrays = [0x5f5f5f, 0x787878, 0x929292, 0xacacac, 0xc6c6c6];
        const roguelikeBaseCount = Math.floor(roguelikeDustCount / roguelikeDustSizes.length);
        roguelikeDustSizes.forEach((size, index) => {
            const count = index === roguelikeDustSizes.length - 1
                ? roguelikeDustCount - (roguelikeBaseCount * index)
                : roguelikeBaseCount;
            const layer = createDustPoints(count, size, roguelikeDustGrays[index], 0.29);
            layer.visible = false;
            roguelikeDustParticles.push(layer);
            dustAtmosphere.add(layer);
        });

        function updateDustAtmosphere() {
            const roguelikeAtmosphere = gameMode === 'roguelike';
            classicDustParticles.visible = !roguelikeAtmosphere;
            roguelikeDustParticles.forEach((layer) => {
                layer.visible = roguelikeAtmosphere;
            });
        }
        updateDustAtmosphere();

        const geometry = new THREE.BoxGeometry(0.96, 0.35, 0.96);
        const materialPadrao = new THREE.MeshLambertMaterial({
            color: activeColors.hiddenTop,
            map: texNoise
        });
        const instancedMesh = new THREE.InstancedMesh(geometry, materialPadrao, GRID_SIZE * GRID_SIZE);
        instancedMesh.castShadow = quality.shadows;    // Blocos geram sombras uns nos outros
        instancedMesh.receiveShadow = quality.shadows;

        const dummy = new THREE.Object3D();
        const offset = (GRID_SIZE - 1) / 2;
        const cellStates = [];

        const spritesGroup = new THREE.Group();
        spritesGroup.renderOrder = 1000;
        scene.add(spritesGroup);

        for(let i = 0; i < GRID_SIZE; i++) {
            for(let j = 0; j < GRID_SIZE; j++) {
                const index = i * GRID_SIZE + j;
                dummy.position.set(i - offset, 0, j - offset);
                dummy.updateMatrix();

                instancedMesh.setMatrixAt(index, dummy.matrix);
                instancedMesh.setColorAt(index, new THREE.Color(activeColors.hiddenTop));
                cellStates.push({ y: 0, scaleY: 1, color: new THREE.Color(activeColors.hiddenTop) });
            }
        }
        scene.add(instancedMesh);

        function applyInstanceTransform(index, px, pz) {
            const state = cellStates[index];
            dummy.position.set(px, state.y, pz);
            dummy.scale.set(1, state.scaleY, 1);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(index, dummy.matrix);
            instancedMesh.setColorAt(index, state.color);
            instancedMesh.instanceMatrix.needsUpdate = true;
            instancedMesh.instanceColor.needsUpdate = true;
        }


        function revealCell(x, y, delay = 0) {
            if(x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return;
            const cell = gridData[x][y];
            if(cell.revealed || cell.flagged) return;
            cell.revealed = true;
            cellsRevealed++;

            const index = x * GRID_SIZE + y;
            const px = x - offset;
            const pz = y - offset;
            const v = cellStates[index];

            const targetColor = new THREE.Color(cell.isMine ? activeColors.mine : activeColors.revealed);
            if (gameMode === 'roguelike') {
                showRogueliteNumber(cell, px, pz);
            }

            gsap.to(v, {
                y: gameMode === 'classic' ? -0.12 : -0.18, scaleY: gameMode === 'classic' ? 0.6 : 0.8, delay: delay, duration: gameMode === 'classic' ? 0.35 : 0.4, ease: gameMode === 'classic' ? "power2.out" : "power2.inOut",
                onUpdate: () => {
                    v.color.lerp(targetColor, gameMode === 'classic' ? 0.15 : 0.2);
                    applyInstanceTransform(index, px, pz);
                },
                onComplete: () => {
                    v.color.copy(targetColor);
                    applyInstanceTransform(index, px, pz);


                    if(gameMode === 'roguelike' && !cell.isMine) {
                        const soundId = sfx.dig.play();
                        sfx.dig.rate(0.8 + Math.random() * 0.4, soundId);
                    }

                    if(gameMode === 'classic' && !cell.isMine && cell.adjacent > 0) {
                        const numberMesh = createSprite(cell.adjacent.toString(), activeColors.numbers[cell.adjacent]);
                        numberMesh.position.set(px, 0.28, pz);
                        spritesGroup.add(numberMesh);
                        gsap.from(numberMesh.scale, { x: 0, y: 0, z: 0, duration: 0.4, ease: "back.out(1.5)" });
                    }
                }
            });

            if(cell.isMine) {
                gameOver = true; // Trava o jogo imediatamente
                clearInterval(timerInterval);
                clearInterval(rogueliteTimer);
                sfx.wind.pause();

                setTimeout(() => {
                    sfx.explosion.play();

                    triggerExplosion(px, 0, pz);
                    const bomb = gameMode === 'classic' ? createClassicBombMesh(true) : createTacticalBombMesh(true);
                    bomb.position.set(px, -0.5, pz);
                    spritesGroup.add(bomb);
                    gsap.to(bomb.position, { y: 0.1, duration: 0.5, ease: "back.out(1.5)" });


                    if (gameMode === 'classic') {
                        focus = 0;
                        uiFocus.innerText = `F:0%`;
                        uiFocus.classList.add('text-red-500');

                        // Pula o dano e vai direto pra Morte
                        isDead = true;
                        isDamaged = false;
                        uiSmileyImg.src = getOperatorImages().death;
                        setTimeout(() => {
                            openReport({
                                title: 'FIELD LOST',
                                copy: 'A mine ended the run. Reset your read, mark the danger, and try the field again.',
                                earned: 0,
                                mode: 'classic'
                            });
                        }, 2800);
                    } else {

                        const mineDamage = getMineDamage();
                        sectorMineHits++;
                        focus -= mineDamage;
                        uiFocus.innerText = `F:${formatFocus(focus)}%`;
                        uiFocus.classList.add('text-red-500');
                        showFieldNotice(`Mine detonated. Operator stabilizing. Focus -${mineDamage}.`, 'danger');


                        triggerHudGlitch();

                        setTimeout(() => uiFocus.classList.remove('text-red-500'), 400);

                        if(focus <= 0) {
                            isDead = true;

                            const reward = Math.round(getSectorPlan(currentSector).reward * 0.35);
                            OPERATOR_DATA.totalFragments += reward;
                            OPERATOR_DATA.save();
                            updateSaveSummary();
                            setTimeout(() => {
                                openReport({
                                    title: 'OPERATOR WOUNDED',
                                    copy: `Mine detonated in sector ${currentSector}. The field spoke first. Material recovered.`,
                                    earned: reward,
                                    focusLeft: focus
                                });
                            }, 3200);
                        } else {
                            gameOver = false; // Se sobreviveu, destrava o jogo
                            if (!sfx.wind.playing()) sfx.wind.play();
                            startActiveTimers();
                            setTimeout(() => {
                                if (!gameOver && !isDead) showFieldNotice('Input restored. Keep moving.', 'success');
                            }, 650);


                            isDamaged = true;
                            uiSmileyImg.src = getOperatorImages().damage;
                            currentSmileySrc = getOperatorImages().damage;
                            gsap.to(uiSmileyImg, { scale: 1.25, duration: 0.15, yoyo: true, repeat: -1, ease: "sine.inOut" });
                            sfx.damage.play();

                            setTimeout(() => {
                                if(!gameOver) {
                                    isDamaged = false;
                                    gsap.killTweensOf(uiSmileyImg);
                                    gsap.to(uiSmileyImg, { scale: 1, duration: 0.2 });
                                    updateSmileyFace();
                                }
                            }, 1200);
                        }
                    }


                    const startX = camera.position.x;
                    const startZ = camera.position.z;
                    gsap.fromTo(camera.position,
                        { x: startX, z: startZ },
                        { x: startX + 0.12, z: startZ + 0.05, yoyo: true, repeat: 9, duration: 0.05, ease: "sine.inOut", onComplete: () => {
                            if (isDead) {
                                if (gameMode === 'roguelike') {

                                    gsap.to(camera, { zoom: 3, duration: 1.5, ease: "power2.inOut", onUpdate: () => camera.updateProjectionMatrix() });
                                    gsap.to(camera.position, { x: px, y: 10, z: pz + 3.18, duration: 1.5, ease: "power2.inOut", onComplete: () => {
                                        uiSmileyImg.src = getOperatorImages().death;
                                        gsap.to('#death-overlay', { opacity: 1, duration: 0.2 });
                                        gsap.killTweensOf(uiSmileyImg);
                                        gsap.to(uiSmileyImg, { scale: 1, duration: 0.2 }); // Retorna escala se estava pulsando
                                    }});
                                } else {

                                    gsap.to(camera.position, { x: startX, z: startZ, duration: 0.2, ease: "power2.out" });
                                    uiSmileyImg.src = getOperatorImages().death;
                                    gsap.to('#death-overlay', { opacity: 1, duration: 0.2 });
                                    gsap.killTweensOf(uiSmileyImg);
                                    gsap.to(uiSmileyImg, { scale: 1, duration: 0.2 });
                                }
                            } else {
                                gsap.to(camera.position, { x: startX, z: startZ, duration: 0.2, ease: "power2.out" });
                            }
                        }}
                    );


                    if (isDead) {
                        for(let i = 0; i < GRID_SIZE; i++) {
                            for(let j = 0; j < GRID_SIZE; j++) {
                                if(gridData[i][j].isMine && !(i === x && j === y) && !gridData[i][j].flagged) {
                                    const idx = i * GRID_SIZE + j;
                                    const v2 = cellStates[idx];
                                    const px2 = i - offset;
                                    const pz2 = j - offset;

                                    gsap.to(v2, {
                                        y: gameMode === 'classic' ? -0.12 : -0.18, scaleY: gameMode === 'classic' ? 0.6 : 0.8, delay: 0.4 + Math.random() * 0.8, duration: gameMode === 'classic' ? 0.35 : 0.4, ease: gameMode === 'classic' ? "power2.out" : "power2.inOut",
                                        onUpdate: () => {
                                            v2.color.lerp(new THREE.Color(activeColors.revealed), gameMode === 'classic' ? 0.15 : 0.2);
                                            applyInstanceTransform(idx, px2, pz2);
                                        },
                                        onComplete: () => {
                                            v2.color.copy(new THREE.Color(activeColors.revealed));
                                            applyInstanceTransform(idx, px2, pz2);
                                            const otherBomb = gameMode === 'classic' ? createClassicBombMesh(false) : createTacticalBombMesh(false);
                                            otherBomb.position.set(px2, -0.5, pz2);
                                            spritesGroup.add(otherBomb);
                                            gsap.to(otherBomb.position, { y: 0.1, duration: 0.5, ease: "back.out(1.5)" });
                                        }
                                    });
                                }
                            }
                        }
                    }
                }, 800);
            } else if(cell.adjacent === 0) {
                // Chama as vizinhas em cascata (Flood Fill)
                const nextDelay = delay + 0.04;
                for(let dx = -1; dx <= 1; dx++) {
                    for(let dy = -1; dy <= 1; dy++) {
                        revealCell(x + dx, y + dy, nextDelay);
                    }
                }
            }


            if(!cell.isMine && cellsRevealed === (GRID_SIZE * GRID_SIZE) - MINES_COUNT) {
                gameOver = true;
                clearInterval(timerInterval);
                clearInterval(rogueliteTimer);

                if (gameMode === 'classic') {

                    uiFocus.innerText = `CLEAR!`;
                    uiFocus.classList.add('text-emerald-400');
                    gsap.to(camera.position, { y: 16, duration: 3, ease: "power2.out" });

                    for(let i = 0; i < GRID_SIZE; i++) {
                        for(let j = 0; j < GRID_SIZE; j++) {
                            if(gridData[i][j].isMine && !gridData[i][j].flagged) {
                                const idx = i * GRID_SIZE + j;
                                toggleFlag(idx, i, j);
                            }
                        }
                    }
                    setTimeout(() => {
                        openReport({
                            title: 'FIELD CLEAR',
                            copy: 'Classic field cleared. Clean read, clean exit.',
                            earned: 0,
                            mode: 'classic'
                        });
                    }, 2600);
                } else {

                    operationActive = false;
                    const reward = getSectorPlan(currentSector).reward;
                    fragmentsCollected += reward; // Fragment reward
                    OPERATOR_DATA.totalFragments += reward;
                    OPERATOR_DATA.save();
                    updateSaveSummary();

                    if (currentSector < MAX_SECTORS) {
                        uiFocus.innerText = `SECTOR CLEAR`;
                        uiFocus.classList.add('text-emerald-400');
                        showFieldNotice(`${getSectorPlan(currentSector).name} secured. +${reward} supplies.`, 'success');


                        setTimeout(() => openSectorChoice(reward), 900);
                    } else {
                        uiFocus.innerText = `MISSION COMPLETE`;
                        uiFocus.classList.add('text-emerald-400');
                        showFieldNotice(`Signal Nest cleared. Operation complete.`, 'success');
                        gsap.to(camera.position, { y: 16, duration: 3, ease: "power2.out" });

                        setTimeout(() => {
                            openReport({
                                title: 'OPERATION COMPLETE',
                                copy: `${MAX_SECTORS} sectors clear. Route complete from ${SECTOR_PLAN[0].name} to ${getSectorPlan(MAX_SECTORS).name}.`,
                                earned: fragmentsCollected
                            });
                        }, 3600);

                    }
                }
            }
        }

        if (new URLSearchParams(window.location.search).has('capture')) {
            window.__minefieldCapture = {
                detonateCenter() {
                    const x = Math.floor(GRID_SIZE / 2);
                    const y = Math.floor(GRID_SIZE / 2);
                    const cell = gridData[x]?.[y];
                    if (!cell || gameOver) return false;
                    cell.isMine = true;
                    cell.revealed = false;
                    cell.flagged = false;
                    if (gameMode === 'roguelike') {
                        focus = 1;
                        uiFocus.innerText = `F:${formatFocus(focus)}%`;
                    }
                    revealCell(x, y);
                    return true;
                },
                pulseReportSupplies() {
                    const earned = document.getElementById('report-earned');
                    const total = document.getElementById('report-total');
                    [earned, total].forEach((node, index) => {
                        if (!node) return;
                        node.animate([
                            { transform: 'scale(1)', filter: 'brightness(1)' },
                            { transform: 'scale(1.5)', filter: 'brightness(1.8)' },
                            { transform: 'scale(1)', filter: 'brightness(1)' }
                        ], {
                            duration: 900,
                            delay: index * 120,
                            easing: 'cubic-bezier(0.16, 1, 0.3, 1)'
                        });
                    });
                    return Boolean(earned);
                }
            };
        }


        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        const boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const boardHitPoint = new THREE.Vector3();
        let lastPointerInputAt = 0;
        let ignoreTouchSequence = false;
        function setPointerFromEvent(event) {
            const source = event.changedTouches ? event.changedTouches[0] : event;
            const rect = canvas.getBoundingClientRect();
            if (
                source.clientX < rect.left ||
                source.clientX > rect.right ||
                source.clientY < rect.top ||
                source.clientY > rect.bottom
            ) {
                return false;
            }

            pointer.x = ((source.clientX - rect.left) / rect.width) * 2 - 1;
            pointer.y = -((source.clientY - rect.top) / rect.height) * 2 + 1;
            return true;
        }


        function getBoardHit() {
            raycaster.setFromCamera(pointer, camera);
            const hit = raycaster.ray.intersectPlane(boardPlane, boardHitPoint);
            if (hit) {
                const x = Math.round(hit.x + offset);
                const y = Math.round(hit.z + offset);
                if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
                    const cellCenterX = x - offset;
                    const cellCenterZ = y - offset;
                    if (Math.abs(hit.x - cellCenterX) <= 0.58 && Math.abs(hit.z - cellCenterZ) <= 0.58) {
                        return {
                            instanceId: x * GRID_SIZE + y,
                            x,
                            y
                        };
                    }
                }
            }

            const intersects = raycaster.intersectObject(instancedMesh);
            if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
                const instanceId = intersects[0].instanceId;
                return {
                    instanceId,
                    x: Math.floor(instanceId / GRID_SIZE),
                    y: instanceId % GRID_SIZE
                };
            }

            const meshMissHit = raycaster.ray.intersectPlane(boardPlane, boardHitPoint);
            if (!meshMissHit) return null;

            const x = Math.round(meshMissHit.x + offset);
            const y = Math.round(meshMissHit.z + offset);
            if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return null;

            const cellCenterX = x - offset;
            const cellCenterZ = y - offset;
            if (Math.abs(meshMissHit.x - cellCenterX) > 0.58 || Math.abs(meshMissHit.z - cellCenterZ) > 0.58) return null;

            return {
                instanceId: x * GRID_SIZE + y,
                x,
                y
            };
        }

        function handleFieldPress(event) {
            disarmRestart();
            if (event.type?.startsWith('pointer')) {
                lastPointerInputAt = performance.now();
            } else if (event.type?.startsWith('touch')) {
                ignoreTouchSequence = performance.now() - lastPointerInputAt < 700;
                if (ignoreTouchSequence) return;
            }
            if(isMenuOpen()) return;
            if(gameOver) return;
            pressedInstanceId = null;

            isLongPress = false;
            if(event.button === 2) return;

            signalOperatorActivity(0.8);
            event.preventDefault?.();
            if (!setPointerFromEvent(event)) return;

            const hit = getBoardHit();

            if (hit) {
                const { instanceId, x, y } = hit;
                const cell = gridData[x][y];


                // Flag mode has to reach an already flagged tile to clear it;
                // every other path still ignores flagged tiles.
                if(!cell.flagged || flagMode) {
                    pressedInstanceId = instanceId;
                    if(!cell.revealed && !cell.flagged) {
                        const v = cellStates[instanceId];
                        gsap.to(v, {
                            y: -0.06, duration: 0.08,
                            onUpdate: () => applyInstanceTransform(instanceId, x - offset, y - offset)
                        });


                        longPressTimer = setTimeout(() => {
                            isLongPress = true;
                            toggleFlag(instanceId, x, y);
                            // Devolve o bloco para a altura original
                            gsap.to(v, { y: 0, duration: 0.1, onUpdate: () => applyInstanceTransform(instanceId, x - offset, y - offset) });
                        }, 550);
                    }
                }
            }
        }


        function handleFieldRelease(event) {
            if (event.type?.startsWith('touch') && ignoreTouchSequence) {
                ignoreTouchSequence = false;
                return;
            }
            if (event.type?.startsWith('pointer')) {
                lastPointerInputAt = performance.now();
            }
            clearTimeout(longPressTimer);
            if(isMenuOpen()) return;
            if(gameOver || event.button === 2 || isLongPress) return;
            signalOperatorActivity(1);
            event.preventDefault?.();

            if(pressedInstanceId !== null) {
                const x = Math.floor(pressedInstanceId / GRID_SIZE);
                const y = pressedInstanceId % GRID_SIZE;

                if(firstClick) {
                    firstClick = false;
                    placeMines(x, y);
                    if (gameMode === 'roguelike') {
                        applySearchAlgo();
                        applyScoutNextSector();
                    }
                    startActiveTimers();


                }

                const cell = gridData[x][y];

                if(flagMode && !cell.revealed) {
                    toggleFlag(pressedInstanceId, x, y);
                    pressedInstanceId = null;
                    return;
                }

                if(cell.revealed && cell.adjacent > 0) {

                    let flagCount = 0;
                    for(let dx = -1; dx <= 1; dx++) {
                        for(let dy = -1; dy <= 1; dy++) {
                            let nx = x + dx, ny = y + dy;
                            if(nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE && gridData[nx][ny].flagged) flagCount++;
                        }
                    }

                    if(flagCount === cell.adjacent) {
                        for(let dx = -1; dx <= 1; dx++) {
                            for(let dy = -1; dy <= 1; dy++) {
                                let nx = x + dx, ny = y + dy;
                                if(nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE && !gridData[nx][ny].revealed && !gridData[nx][ny].flagged) {
                                    revealCell(nx, ny);
                                }
                            }
                        }
                    }
                } else if(!cell.revealed) {
                    revealCell(x, y);
                }
                pressedInstanceId = null;
            }
        }

        window.addEventListener('pointerdown', handleFieldPress, { passive: false });
        window.addEventListener('pointerup', handleFieldRelease, { passive: false });
        canvas.addEventListener('touchstart', handleFieldPress, { passive: false });
        canvas.addEventListener('touchend', handleFieldRelease, { passive: false });
        canvas.addEventListener('touchcancel', () => {
            clearTimeout(longPressTimer);
            pressedInstanceId = null;
        }, { passive: true });

        // Clique Direito (Bandeira no PC)
        window.addEventListener('contextmenu', (event) => {
            event.preventDefault(); // Impede o menu do navegador de abrir
            if(isMenuOpen()) return;
            if(gameOver) return;
            signalOperatorActivity(0.95);

            if (!setPointerFromEvent(event)) return;

            const hit = getBoardHit();

            if (hit) {
                const { instanceId, x, y } = hit;
                toggleFlag(instanceId, x, y);
            }
        });


        window.addEventListener('keydown', (e) => {
            if(isMenuOpen()) return;
            if (e.code === 'Space') triggerSonar();
        });

        function applyViewportResize() {
            syncViewportClass();
            refreshSectorHudLabel();
            playViewport = getPlayViewport();
            const aspect = playViewport.width / playViewport.height;
            frustumSize = getFrustumSize(aspect);
            camera.left = -frustumSize * aspect / 2;
            camera.right = frustumSize * aspect / 2;
            camera.top = frustumSize / 2;
            camera.bottom = -frustumSize / 2;
            camera.updateProjectionMatrix();
            syncCanvasSize();
            renderer.setPixelRatio(quality.pixelRatio);
            if (useComposer) {
                composer.setPixelRatio(quality.pixelRatio);
                composer.setSize(playViewport.width, playViewport.height);
            }
        }

        window.addEventListener('resize', applyViewportResize);
        window.addEventListener('orientationchange', () => {
            requestAnimationFrame(applyViewportResize);
            setTimeout(applyViewportResize, 250);
        });
        window.visualViewport?.addEventListener('resize', applyViewportResize);

        let animationFrameId = null;

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                gsap.ticker.sleep(); // Pausa o motor do GSAP quando minimizado
            } else {
                gsap.ticker.wake();
                if (animationFrameId === null) animate();
            }
        });

        function animate() {
            if (document.hidden) {
                animationFrameId = null;
                return;
            }
            animationFrameId = requestAnimationFrame(animate);
            updateSmileyFace();


            dustAtmosphere.rotation.y += 0.0012;
            dustAtmosphere.rotation.x += 0.0006;
            tacticalNumberBillboards.forEach((numberMesh) => numberMesh.quaternion.copy(camera.quaternion));


            const time = performance.now() * 0.005;
            flagsMap.forEach((itemGroup) => {
                if (gameMode === 'classic') {

                    if (itemGroup.children.length >= 4) {
                        const flagMesh = itemGroup.children[3];
                        if (flagMesh.geometry.attributes.baseZ) {
                            const positions = flagMesh.geometry.attributes.position;
                            const baseZ = flagMesh.geometry.attributes.baseZ.array;
                            for(let i = 0; i < positions.count; i++) {
                                const x = positions.getX(i);
                                const windZ = Math.sin(time + itemGroup.position.x + x * 15) * (x * 0.06) + Math.cos(time * 1.5 + itemGroup.position.z + x * 10) * (x * 0.03);
                                positions.setZ(i, baseZ[i] + windZ);
                            }
                            positions.needsUpdate = true;
                            flagMesh.geometry.computeVertexNormals();
                        }
                    }
                } else {
                    // Pulso de LED no Roguelite
                    if(itemGroup.children.length >= 3) {
                        const ledMat = itemGroup.children[1].material;
                        const pointLight = itemGroup.children[2];
                        const intensity = (Math.sin(time * 1.5) + 1) / 2;
                        ledMat.emissiveIntensity = 0.5 + intensity * 2.5;
                        pointLight.intensity = 0.5 + intensity * 1.5;
                    }
                }
            });

            if (useComposer) {
                composer.render();
            } else {
                renderer.render(scene, camera);
            }
        }
        animate();
