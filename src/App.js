import React from 'react';
import './App.css';
import {ffmpeg} from './ffmpeg';

function App() {
    const fileRef = React.createRef();
    const [state, setState] = React.useState({
        progress: 0,
        isUnknown: false,
        isProcessing: false,
        isDone: false,
        convertedFiles: []
    });

    const onFileChange = async () => {
        const files = fileRef.current.files;
        const convertedFiles = [];

        setState({
            isProcessing: true,
            isUnknown: true,
            isDone: false,
            progress: 0,
        });
        for (let i = 0; i < files.length; i++) {
            convertedFiles.push(await ffmpeg(files[i], (progress) => {
                setState({
                    isDone: false,
                    isUnknown: false,
                    isProcessing: true,
                    progress: progress,
                });
            }));
        }

        setState({
            isDone: true,
            isUnknown: true,
            isProcessing: false,
            progress: 0,
            convertedFiles
        });
    };

    if (state.convertedFiles.length > 0) {
        console.log(state.convertedFiles)
        state.convertedFiles.forEach((file) => {
            const url = URL.createObjectURL(file);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'out.mp4';
            a.click();
        })
    }

    return (
        <div className="App">
            <header className="App-header">
                <p>
                    {state.isUnknown
                        ? 'Initializing...'
                        : state.isProcessing === false
                            ? 'Select a file for encoding'
                            : 'Converting...'}
                </p>
                <input onChange={onFileChange}
                       className="input-file"
                       ref={fileRef}
                       type={'file'}
                       role={'button'}/>
                {state.isProcessing === false
                && <button onClick={() => fileRef.current.click()}>Select file</button>}
                {state.isProcessing === true
                && <progress max={state.isUnknown ? undefined : 1}
                             value={state.isUnknown ? undefined : state.progress}></progress>}

                {state.isDone && state.convertedFiles.map(file => <>
                    file
                </>)}
            </header>
        </div>
    );
}

export default App;
