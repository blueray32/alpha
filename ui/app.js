/**
 * TinyLink - Client JavaScript
 * Owner: Blink
 */

const API_BASE = 'http://localhost:5050';

// Elements
const form = document.getElementById('shorten-form');
const urlInput = document.getElementById('url-input');
const shortenBtn = document.getElementById('shorten-btn');
const btnText = document.querySelector('.btn-text');
const btnLoading = document.querySelector('.btn-loading');
const resultDiv = document.getElementById('result');
const errorDiv = document.getElementById('error');
const shortUrlInput = document.getElementById('short-url');
const copyBtn = document.getElementById('copy-btn');
const copyText = document.querySelector('.copy-text');
const copiedText = document.querySelector('.copied-text');
const originalUrlLink = document.getElementById('original-url');
const clickCount = document.getElementById('click-count');
const refreshStatsBtn = document.getElementById('refresh-stats');
const shortenAnotherBtn = document.getElementById('shorten-another');

let currentCode = null;

// Form submission
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const url = urlInput.value.trim();
  if (!url) return;

  // Show loading state
  shortenBtn.disabled = true;
  btnText.style.display = 'none';
  btnLoading.style.display = 'inline';
  errorDiv.style.display = 'none';

  try {
    const response = await fetch(`${API_BASE}/api/shorten`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to shorten URL');
    }

    // Show result
    currentCode = data.code;
    shortUrlInput.value = data.shortUrl;
    originalUrlLink.href = data.originalUrl;
    originalUrlLink.textContent = data.originalUrl;
    clickCount.textContent = '0';

    resultDiv.style.display = 'block';
    form.style.display = 'none';

  } catch (error) {
    errorDiv.textContent = error.message;
    errorDiv.style.display = 'block';
  } finally {
    shortenBtn.disabled = false;
    btnText.style.display = 'inline';
    btnLoading.style.display = 'none';
  }
});

// Copy to clipboard
copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shortUrlInput.value);

    // Show copied feedback
    copyText.style.display = 'none';
    copiedText.style.display = 'inline';
    copyBtn.classList.add('copied');

    setTimeout(() => {
      copyText.style.display = 'inline';
      copiedText.style.display = 'none';
      copyBtn.classList.remove('copied');
    }, 2000);

  } catch (error) {
    alert('Failed to copy to clipboard');
  }
});

// Refresh stats
refreshStatsBtn.addEventListener('click', async () => {
  if (!currentCode) return;

  try {
    const response = await fetch(`${API_BASE}/api/stats/${currentCode}`);
    const data = await response.json();

    if (response.ok) {
      clickCount.textContent = data.clicks;
    }
  } catch (error) {
    console.error('Failed to refresh stats:', error);
  }
});

// Shorten another URL
shortenAnotherBtn.addEventListener('click', () => {
  resultDiv.style.display = 'none';
  form.style.display = 'block';
  urlInput.value = '';
  urlInput.focus();
  currentCode = null;
});

// Auto-refresh stats every 5 seconds when result is visible
setInterval(() => {
  if (resultDiv.style.display !== 'none' && currentCode) {
    refreshStatsBtn.click();
  }
}, 5000);
