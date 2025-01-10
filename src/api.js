// API related functions
export async function sendMessage(messages) {
    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages }),
      });
  
      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }
  
      return response.json();
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new Error('Server is not running. Please start the local server.');
      }
      console.error('Error:', error);
      throw error;
    }
  }
  
export async function askClaudeLocal(question) {
  try {
    const response = await sendMessage([{
      role: 'user',
      content: question
    }]);
    return response.content[0].text;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

export async function readFile() {
  try {
    ///const response = await fetch('/public/create/src/create.js');    //single file
    ///const scriptContent = await response.text();                     //single file
    ///return scriptContent;                                            //single file

    const [file1Content, file2Content] = await Promise.all([
      //fetch('/public/create/src/create.js').then(r => r.text()),
      fetch('/create/src/create.js').then(r => r.text()),
      //fetch('/public/create/src/lib/programs/site.js').then(r => r.text())
      fetch('/create/src/lib/programs/site.js').then(r => r.text())

    ]);
    const combinedContent = `${file1Content}\n${file2Content}`;
    return combinedContent;
  } catch (error) {
    console.error('Error loading script:', error);
  }
}
