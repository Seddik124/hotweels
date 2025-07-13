document.addEventListener('DOMContentLoaded', function() {
    // Éléments DOM
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    const fileInfo = document.getElementById('fileInfo');
    const resultsContainer = document.getElementById('resultsContainer');
    const resultStats = document.getElementById('resultStats');
    const summaryCards = document.getElementById('summaryCards');
    const tableHeader = document.getElementById('tableHeader');
    const tableBody = document.getElementById('tableBody');
    const downloadBtn = document.getElementById('downloadBtn');
    const statusMessage = document.getElementById('statusMessage');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    let currentFile = null;
    let processedData = null;
    let currentAction = null;

    // Gestion du drag and drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    function highlight() {
        dropZone.classList.add('highlight');
    }

    function unhighlight() {
        dropZone.classList.remove('highlight');
    }

    dropZone.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0 && isValidFile(files[0])) {
            handleFiles(files);
        }
    }

    // Gestion du clic sur le bouton Parcourir
    browseBtn.addEventListener('click', function() {
        fileInput.click();
    });

    // Gestion de la sélection de fichier
    fileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0 && isValidFile(e.target.files[0])) {
            handleFiles(e.target.files);
        }
    });

    function isValidFile(file) {
        const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
        return validTypes.includes(file.type) || file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    }

    function handleFiles(files) {
        currentFile = files[0];
        
        // Afficher les informations du fichier
        fileInfo.innerHTML = `
            <div>
                <i class="fas fa-file-excel"></i>
                <span>${currentFile.name}</span>
                <span class="file-size">(${formatFileSize(currentFile.size)})</span>
            </div>
            <button class="clear-btn" id="clearFile"><i class="fas fa-times"></i></button>
        `;
        fileInfo.style.display = 'flex';
        
        // Ajouter l'événement pour le bouton de suppression
        document.getElementById('clearFile').addEventListener('click', clearFile);
        
        showStatus('Fichier prêt pour analyse', 'success');
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i]);
    }

    function clearFile() {
        currentFile = null;
        fileInfo.style.display = 'none';
        resultsContainer.classList.add('hidden');
        showStatus('', 'success');
    }

    // Gestion des options d'analyse
    document.querySelectorAll('.option-card').forEach(card => {
        card.addEventListener('click', function() {
            if (!currentFile) {
                showStatus('Veuillez d\'abord sélectionner un fichier', 'error');
                return;
            }
            
            currentAction = this.getAttribute('data-action');
            processFile();
        });
    });

    // Gestion des onglets
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            
            // Désactiver tous les onglets
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Activer l'onglet sélectionné
            this.classList.add('active');
            document.getElementById(tabId + 'Tab').classList.add('active');
        });
    });

    // Traitement du fichier
    function processFile() {
        showStatus('Analyse en cours...', 'loading');
        
        const formData = new FormData();
        formData.append('file', currentFile);
        formData.append('action', currentAction);

        fetch('/process', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Erreur lors du traitement');
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }

            // Afficher les résultats
            displayResults(data);
            processedData = data.file;
            resultsContainer.classList.remove('hidden');
            showStatus('Analyse terminée avec succès', 'success');
        })
        .catch(error => {
            console.error('Error:', error);
            showStatus(error.message, 'error');
        });
    }

    // Affichage des résultats
    function displayResults(data) {
        // Effacer les résultats précédents
        resultStats.innerHTML = '';
        summaryCards.innerHTML = '';
        tableHeader.innerHTML = '';
        tableBody.innerHTML = '';

        if (data.message) {
            // Aucun problème détecté
            resultStats.innerHTML = `
                <div class="stat-card">
                    <i class="fas fa-check-circle"></i>
                    <span>Aucun problème détecté</span>
                </div>
            `;
            downloadBtn.style.display = 'none';
            return;
        }

        if (currentAction === 'detect_errors') {
            // Résultats pour la détection d'erreurs
            const errorCount = data.results.errors.length;
            
            resultStats.innerHTML = `
                <div class="stat-card error">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>${errorCount} erreur${errorCount !== 1 ? 's' : ''} détectée${errorCount !== 1 ? 's' : ''}</span>
                </div>
            `;

            // Remplir le résumé
            const errorsByColumn = {};
            data.results.errors.forEach(error => {
                if (!errorsByColumn[error.Colonne]) {
                    errorsByColumn[error.Colonne] = 0;
                }
                errorsByColumn[error.Colonne]++;
            });

            for (const [col, count] of Object.entries(errorsByColumn)) {
                summaryCards.innerHTML += `
                    <div class="summary-item error">
                        <h4>${col}</h4>
                        <p>${count} erreur${count !== 1 ? 's' : ''}</p>
                    </div>
                `;
            }

            // Remplir le tableau détaillé
            const headers = ['Ligne', 'Colonne', 'Valeur', 'Problème'];
            tableHeader.innerHTML = headers.map(h => `<th>${h}</th>`).join('');
            
            data.results.errors.forEach(error => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${error.Ligne}</td>
                    <td>${error.Colonne}</td>
                    <td>${error.Valeur || 'N/A'}</td>
                    <td>${error.Problème}</td>
                `;
                tableBody.appendChild(row);
            });
        } 
        else if (currentAction === 'detect_duplicates') {
            // Résultats pour la détection de doublons
            const duplicateCount = data.results.doublons.length;
            
            resultStats.innerHTML = `
                <div class="stat-card duplicate">
                    <i class="fas fa-clone"></i>
                    <span>${duplicateCount} doublon${duplicateCount !== 1 ? 's' : ''} détecté${duplicateCount !== 1 ? 's' : ''}</span>
                </div>
            `;

            // Remplir le résumé
            const coordGroups = {};
            data.results.doublons.forEach(dup => {
                const key = `${dup.Latitude},${dup.Longitude}`;
                if (!coordGroups[key]) {
                    coordGroups[key] = {
                        coord: key,
                        count: 0,
                        lines: []
                    };
                }
                coordGroups[key].count++;
                coordGroups[key].lines.push(dup.Ligne);
            });

            for (const group of Object.values(coordGroups)) {
                summaryCards.innerHTML += `
                    <div class="summary-item duplicate">
                        <h4>${group.coord}</h4>
                        <p>${group.count} occurrence${group.count !== 1 ? 's' : ''}</p>
                        <p class="small">Lignes: ${group.lines.join(', ')}</p>
                    </div>
                `;
            }

            // Remplir le tableau détaillé
            const headers = ['Ligne', 'Identifiant', 'Latitude', 'Longitude'];
            tableHeader.innerHTML = headers.map(h => `<th>${h}</th>`).join('');
            
            data.results.doublons.forEach(dup => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${dup.Ligne}</td>
                    <td>${dup.Identifiant}</td>
                    <td>${dup.Latitude}</td>
                    <td>${dup.Longitude}</td>
                `;
                tableBody.appendChild(row);
            });
        }

        // Activer le bouton de téléchargement
        downloadBtn.style.display = 'flex';
    }

    // Téléchargement du fichier
    downloadBtn.addEventListener('click', function() {
        if (!processedData) {
            showStatus('Aucune donnée à télécharger', 'error');
            return;
        }

        showStatus('Préparation du téléchargement...', 'loading');
        
        fetch('/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ file: processedData })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Erreur lors du téléchargement');
            }
            return response.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `resultats_${currentAction}_${new Date().toISOString().slice(0,10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            showStatus('Téléchargement terminé', 'success');
        })
        .catch(error => {
            console.error('Error:', error);
            showStatus(error.message, 'error');
        });
    });

    // Affichage des messages de statut
    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = 'status-message ' + type;
    }
});