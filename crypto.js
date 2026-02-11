// Cryptographic functions translated from Java to JavaScript
// Updated to match new Java implementation with AES-GCM and SHA-256

// Constants matching Java implementation
const PBKDF2_ITERATIONS = 100000; // Increased from 65536
const KEY_LENGTH = 256;
const GCM_IV_LENGTH = 12; // 96 bits for GCM
const GCM_TAG_LENGTH = 128; // 128 bits authentication tag

/**
 * Calculate SHA-256 hash of the index (equivalent to Java's getHash method)
 * @param {string} index - The index number to hash
 * @returns {Promise<string>} - Hexadecimal hash string (uppercase)
 */
async function getHash(index) {
    const encoder = new TextEncoder();
    const data = encoder.encode(index);
    
    // Use Web Crypto API to compute SHA-256
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // Convert buffer to hex string (uppercase to match Java)
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join('');
    
    return hashHex;
}

/**
 * Generate deterministic filename from index and id
 * @param {string} index - The student index
 * @param {string} id - The student ID
 * @returns {Promise<string>} - Filename in format {hash}.enc
 */
async function getEncryptedFilename(index, id) {
    const encoder = new TextEncoder();
    const combined = index + "|" + id; // Combine with delimiter
    const data = encoder.encode(combined);
    
    // Hash the combined string
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join('');
    
    return hashHex + '.enc';
}

/**
 * Derive AES key from ID and index (equivalent to Java's getKey method)
 * Uses PBKDF2 with HMAC-SHA256 and 100,000 iterations
 * @param {string} id - The ID (password)
 * @param {string} index - The index number (salt)
 * @returns {Promise<CryptoKey>} - AES-256 key for GCM mode
 */
async function getKey(id, index) {
    const encoder = new TextEncoder();
    
    // Import the password as key material
    const passwordKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(id),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );
    
    // Derive AES key using PBKDF2 with 100,000 iterations
    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encoder.encode(index),
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256'
        },
        passwordKey,
        {
            name: 'AES-GCM',
            length: KEY_LENGTH
        },
        false,
        ['decrypt', 'encrypt']
    );
    
    return key;
}

/**
 * Decrypt the file content using AES-GCM (equivalent to Java's decrypt method)
 * File format: [12-byte IV][encrypted data with 16-byte auth tag]
 * @param {CryptoKey} key - AES-GCM key
 * @param {ArrayBuffer} encryptedData - Encrypted file data with IV prepended
 * @returns {Promise<string>} - Decrypted content
 */
async function decrypt(key, encryptedData) {
    try {
        // Check if file is large enough to contain IV
        if (encryptedData.byteLength < GCM_IV_LENGTH) {
            throw new Error('Invalid encrypted file: too short to contain IV');
        }
        
        // Extract IV from the beginning of the file (12 bytes for GCM)
        const iv = new Uint8Array(encryptedData.slice(0, GCM_IV_LENGTH));
        
        // The rest is the ciphertext (includes the authentication tag)
        const ciphertext = encryptedData.slice(GCM_IV_LENGTH);
        
        console.log('Decryption details:');
        console.log('- IV length:', iv.length, 'bytes');
        console.log('- Ciphertext length:', ciphertext.byteLength, 'bytes');
        console.log('- Using AES-GCM with', PBKDF2_ITERATIONS, 'iterations');
        
        // Decrypt using AES-GCM
        const decryptedBuffer = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: iv,
                tagLength: GCM_TAG_LENGTH
            },
            key,
            ciphertext
        );
        
        // Convert to string
        const decoder = new TextDecoder('utf-8');
        const decryptedText = decoder.decode(decryptedBuffer);
        
        console.log('Decryption successful! Content length:', decryptedText.length, 'characters');
        
        return decryptedText;
        
    } catch (error) {
        console.error('Decryption failed:', error);
        
        // Provide more helpful error messages
        if (error.name === 'OperationError') {
            throw new Error('Decryption failed: Invalid credentials or corrupted file. The authentication tag verification failed.');
        } else if (error.message.includes('too short')) {
            throw new Error('Invalid encrypted file format: File is too small.');
        } else {
            throw new Error('Decryption failed: ' + error.message);
        }
    }
}

/**
 * Fetch encrypted file from GitHub
 * @param {string} filename - The filename to fetch (e.g., "HASH.enc")
 * @returns {Promise<ArrayBuffer>} - File content
 */
async function fetchFile(filename) {
    const url = `https://pasinduravimal.github.io/GPACalculator/files/${filename}`;
    
    console.log('Fetching file from:', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }
    
    return await response.arrayBuffer();
}

/**
 * Main function to handle form submission
 */
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
        // Step 1: Generate encrypted filename from index and id
        console.log('Generating filename...');
        const filename = await getEncryptedFilename(indexNumber, id);
        console.log('Filename:', filename);
        
        // Step 2: Fetch encrypted file
        console.log('Fetching encrypted file...');
        const encryptedData = await fetchFile(filename);
        console.log('File fetched, size:', encryptedData.byteLength, 'bytes');
        
        // Step 3: Derive decryption key
        console.log('Deriving AES-GCM key with', PBKDF2_ITERATIONS, 'iterations...');
        const key = await getKey(id, indexNumber);
        console.log('Key derived successfully');
        
        // Step 4: Decrypt the content using AES-GCM
        console.log('Decrypting with AES-GCM...');
        const decryptedContent = await decrypt(key, encryptedData);
        console.log('Decryption successful!');
        
        // Step 5: Display the content
        // Expand container for better viewing
        const container = document.querySelector('.container');
        container.classList.add('expanded');
        
        // Hide the form to give more space
        document.getElementById('decryptForm').style.display = 'none';
        
        // Add a back button
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
        
        // Check if content is HTML
        if (decryptedContent.trim().toLowerCase().startsWith('<!doctype') || 
            decryptedContent.trim().toLowerCase().startsWith('<html')) {
            
            // Create an iframe to display HTML safely
            const iframe = document.createElement('iframe');
            iframe.style.width = '100%';
            iframe.style.height = '80vh';
            iframe.style.border = '1px solid #ddd';
            iframe.style.borderRadius = '5px';
            iframe.style.minHeight = '600px';
            
            // Use sandbox to control permissions
            // Remove 'allow-popups' and 'allow-popups-to-escape-sandbox' to prevent new windows
            iframe.sandbox = 'allow-same-origin allow-scripts allow-forms allow-modals';
            
            contentDiv.appendChild(iframe);
            
            // Write content to iframe
            iframe.contentDocument.open();
            iframe.contentDocument.write(decryptedContent);
            iframe.contentDocument.close();
            
        } else {
            // Display as text
            const pre = document.createElement('pre');
            pre.textContent = decryptedContent;
            pre.style.whiteSpace = 'pre-wrap';
            pre.style.wordWrap = 'break-word';
            contentDiv.appendChild(pre);
        }
        
        contentDiv.classList.add('show');
        
    } catch (error) {
        console.error('Error:', error);
        errorDiv.textContent = `Error: ${error.message}`;
        errorDiv.classList.add('show');
    } finally {
        loadingDiv.classList.remove('show');
        submitButton.disabled = false;
    }
});
