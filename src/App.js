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
            isUnknown: false,
            isProcessing: false,
            progress: 0,
            convertedFiles
        });
    };

    const downloadFile = (file) => {
        const url = URL.createObjectURL(new Blob([file], {type: 'video/mp4'}));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'out.mp4';
        a.click();
    };

    const reset = () => {
        setState({
            progress: 0,
            isUnknown: false,
            isProcessing: false,
            isDone: false,
            convertedFiles: []
        });
    };

    return (
        <div className="App">
            <header className="App-header">
                <p>
                    {state.isUnknown
                        ? 'Initializing...'
                        : state.isProcessing
                            ? 'Converting...'
                            : state.isDone
                                ? 'Done!'
                                : 'Select a video file for encoding'}
                </p>
                {state.isDone === false && <>

                    <input onChange={onFileChange}
                           className="input-file"
                           ref={fileRef}
                           type={'file'}
                           role={'button'}/>
                    {state.isProcessing === false
                    && <p>
                        <button onClick={() => fileRef.current.click()}>Select file</button>
                    </p>}

                    {state.isProcessing === true
                    && <p>
                        <progress max={state.isUnknown ? undefined : 1}
                                  value={state.isUnknown ? undefined : state.progress}></progress>
                    </p>}

                </>}

                {state.isDone && <>
                    {state.convertedFiles.map(file => <p>
                        <button onClick={() => downloadFile(file)}>Download</button>
                    </p>)}

                    <p><button onClick={reset}>Restart</button></p>
                </>}
            </header>
        </div>
    );
}

export default App;
