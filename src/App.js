import React from 'react';
import './App.css';
import { ffmpeg } from './ffmpeg';

const processFile = async (file) => {
    const data = await new Response(file).arrayBuffer();

    let stderr = "";
    let stdout = "";

    await ffmpeg(file);
};

function App() {
    const fileRef = React.createRef();

    const onFileChange = () => {
        for (let i = 0; i < fileRef.current.files.length; i++) {
            processFile(fileRef.current.files[i])
        }
    };

    return (
        <div className="App">
            <header className="App-header">
                <p>
                    Select a file for encoding
                </p>
                <input onChange={onFileChange} className="input-file" ref={fileRef} type={'file'} role={'button'}/>
                <button onClick={() => fileRef.current.click()}>Select file</button>
            </header>
        </div>
    );
}

export default App;
