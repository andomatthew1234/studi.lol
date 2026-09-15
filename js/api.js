window.MODEL_FALLBACK_CHAIN = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];
window.AUDIO_MODEL_CHAIN = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'];

window.dynamicGeminiFetch = async function(apiKey, bodyPayload, onStatusUpdate, apiVersion = 'v1beta', chain = window.MODEL_FALLBACK_CHAIN) {
    for (let i = 0; i < chain.length; i++) {
        const model = chain[i];
        let attempt = 1;
        while (attempt <= 2) {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bodyPayload)
                });
                if (response.ok) return await response.json();
                if (response.status === 429) {
                    if (i < chain.length - 1) onStatusUpdate(`Rate limit hit on ${model}. Switching to ${chain[i + 1]}...`);
                    break; 
                } else if (response.status >= 500) {
                    onStatusUpdate(`Google busy on ${model}. Retrying...`);
                    await new Promise(r => setTimeout(r, 2000));
                    attempt++;
                } else {
                    throw new Error(`API error (${response.status}). Check key.`);
                }
            } catch (err) {
                if (err.message.includes("API error")) throw err;
                onStatusUpdate(`Network retry on ${model}...`);
                await new Promise(r => setTimeout(r, 2000));
                attempt++;
            }
        }
    }
    throw new Error("All fallback models hit rate limits. Give it a minute and try again.");
};