// Alternative crypto.js with option to open decrypted content in new window
// This version gives you three options for displaying content

// Copy the getHash, getKey, decrypt, and fetchFile functions from crypto.js
// Then replace the form submission handler with this:

document.getElementById('decryptForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form values
    const indexNumber = document.getElementById('indexNumber').value.trim();
    const id = document.getElementById('id').value.trim();
    
    // UI elements
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const contentDiv = document.getElementById('content-display');
    const submitButton = e.target.querySelector('button[type="submit"]');
    
    // Reset UI
    loadingDiv.classList.add('show');
    errorDiv.classList.remove('show');
    contentDiv.classList.remove('show');
    contentDiv.innerHTML = '';
    submitButton.disabled = true;
    
    try {
        // Step 1: Calculate hash of index
        console.log('Calculating hash...');
        const hash = await getHash(indexNumber);
        console.log('Hash:', hash);
        
        // Step 2: Fetch encrypted file
        console.log('Fetching file...');
        const encryptedData = await fetchFile(hash);
        console.log('File fetched, size:', encryptedData.byteLength, 'bytes');
        
        // Step 3: Derive decryption key
        console.log('Deriving key...');
        const key = await getKey(id, indexNumber);
        console.log('Key derived');
        
        // Step 4: Decrypt the content
        console.log('Decrypting...');
        const decryptedContent = await decrypt(key, encryptedData);
        console.log('Decryption successful');
        
        // Step 5: Display the content
        // Check if content is HTML
        if (decryptedContent.trim().toLowerCase().startsWith('<!doctype') || 
            decryptedContent.trim().toLowerCase().startsWith('<html')) {
            
            // OPTION A: Replace current page (full navigation support, no back button)
            document.open();
            document.write(decryptedContent);
            document.close();
            
            /* OPTION B: Open in new window (keeps original page intact)
            const newWindow = window.open('', '_blank');
            if (newWindow) {
                newWindow.document.open();
                newWindow.document.write(decryptedContent);
                newWindow.document.close();
                
                // Show success message
                contentDiv.innerHTML = '<p style="color: green; text-align: center; padding: 20px;">✅ Content opened in new window!</p>';
                contentDiv.classList.add('show');
            } else {
                throw new Error('Popup blocked. Please allow popups for this site.');
            }
            */
            
            /* OPTION C: Display in iframe with back button (limited navigation)
            const container = document.querySelector('.container');
            container.classList.add('expanded');
            document.getElementById('decryptForm').style.display = 'none';
            
            const backButton = document.createElement('button');
            backButton.textContent = '← Back to Form';
            backButton.style.marginBottom = '20px';
            backButton.onclick = () => {
                container.classList.remove('expanded');
                document.getElementById('decryptForm').style.display = 'block';
                contentDiv.classList.remove('show');
                contentDiv.innerHTML = '';
                errorDiv.classList.remove('show');
            };
            contentDiv.appendChild(backButton);
            
            const iframe = document.createElement('iframe');
            iframe.srcdoc = decryptedContent;
            iframe.sandbox = 'allow-same-origin allow-scripts allow-forms allow-popups allow-modals';
            contentDiv.appendChild(iframe);
            contentDiv.classList.add('show');
            */
            
        } else {
            // Display as text
            const container = document.querySelector('.container');
            container.classList.add('expanded');
            document.getElementById('decryptForm').style.display = 'none';
            
            const backButton = document.createElement('button');
            backButton.textContent = '← Back to Form';
            backButton.style.marginBottom = '20px';
            backButton.onclick = () => {
                container.classList.remove('expanded');
                document.getElementById('decryptForm').style.display = 'block';
                contentDiv.classList.remove('show');
                contentDiv.innerHTML = '';
                errorDiv.classList.remove('show');
            };
            contentDiv.appendChild(backButton);
            
            const pre = document.createElement('pre');
            pre.textContent = decryptedContent;
            pre.style.whiteSpace = 'pre-wrap';
            pre.style.wordWrap = 'break-word';
            contentDiv.appendChild(pre);
            contentDiv.classList.add('show');
        }
        
    } catch (error) {
        console.error('Error:', error);
        errorDiv.textContent = `Error: ${error.message}`;
        errorDiv.classList.add('show');
    } finally {
        loadingDiv.classList.remove('show');
        submitButton.disabled = false;
    }
});
