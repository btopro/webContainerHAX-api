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


//NEW for API
export async function sendMessageRemote(messages) {
  try {

    const keyResponse = await fetch('http://localhost:3001/api/chatRemote');
    let getKey = await keyResponse.text();
    
    // Clean up the key - remove quotes and extra Bearer prefix
    getKey = getKey.replace(/"/g, '').replace(/^Bearer\s+/, '');
    
    // Add single Bearer prefix
    getKey = `Bearer ${getKey}`;

    const response = await fetch('https://ai.services.hax.psu.edu/agentic-ai-hax-cli', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authorization': getKey,
      },
      body: JSON.stringify({
        query: messages.query,
        engine: messages.engine,
        need_rag: messages.need_rag
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Error details:', errorText);
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const responseData = await response.json();
    //console.log('Full API response:', responseData);  // Let's see what we're getting
    return responseData;
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      throw new Error('Server is not running. Please start the local server.');
    }
    console.error('Error:', error);
    throw error;
  }
}

export async function askClaudeRemote(question) {
  try {
    const response = await sendMessageRemote({
      query: question,
      engine: "Claude",
      need_rag: false
    });
    //console.log('Response in askClaudeRemote:', response); // See what we have here
    
    // Check the structure of the response
    if (response && response.result && response.result.commands) {
      return response.result.commands;
    } else {
      console.log('Unexpected response structure:', response);
      return 'Unable to extract commands from response';
    }
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}



//NEW for ICDS
export async function sendMessageICDSRemote(messages) {
  try {

    const keyResponse = await fetch('http://localhost:3001/api/chatRemote');
    let getKey = await keyResponse.text();
    
    // Clean up the key - remove quotes and extra Bearer prefix
    getKey = getKey.replace(/"/g, '').replace(/^Bearer\s+/, '');
    
    // Add single Bearer prefix
    getKey = `Bearer ${getKey}`;

    const response = await fetch('https://ai.services.hax.psu.edu/agentic-ai-hax-cli', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authorization': getKey,
      },
      body: JSON.stringify({
        query: messages.query,
        engine: messages.engine,
        need_rag: messages.need_rag
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Error details:', errorText);
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const responseData = await response.json();
    //console.log('Full API response:', responseData);  // Let's see what we're getting
    return responseData;
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      throw new Error('Server is not running. Please start the local server.');
    }
    console.error('Error:', error);
    throw error;
  }
}

export async function askICDSRemote(question) {
  try {
    const response = await sendMessageICDSRemote({
      query: question,
      engine: "ICDS",
      need_rag: false
    });
    //console.log('Response in askClaudeRemote:', response); // See what we have here
    
    // Check the structure of the response
    if (response && response.result && response.result.commands) {
      return response.result.commands;
    } else {
      console.log('Unexpected response structure:', response);
      return 'Unable to extract commands from response';
    }
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

