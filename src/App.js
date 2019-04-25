import React from 'react';
import './App.css';
import { ffmpeg } from './ffmpeg';

const processFile = async (file) => {
    const data = await new Response(file).arrayBuffer();

    let stderr = "";
    let stdout = "";

    await ffmpeg(file);
    // let result = await ffmpegjs({
    //     arguments: [
    //         '-y',
    //         '-i',
    //         file.name,
    //         "-c:v",
    //         "libx264",
    //         "-preset",
    //         "slower",
    //         "-crf",
    //         "21",
    //         "-c:a",
    //         "aac",
    //         "-b:a",
    //         "96k",
    //         "-pix_fmt",
    //         "yuv420p",
    //         "-profile:v",
    //         "high",
    //         "-level",
    //         "4.1",
    //         "-movflags",
    //         "faststart",
    //         "-vf",
    //         "scale=-1:404",
    //         'output.mp4'],
    //     MEMFS: [{name: file.name, data: data}],
    //     // stdin: Comlink.proxyValue(() => { }),
    //     // stdout: Comlink.proxyValue(() => { console.log('out') }),
    //     // stderr: Comlink.proxyValue(() => { console.log('err') }),
    //     onfilesready: Comlink.proxyValue((e) => {
    //         let data = e.MEMFS[0].data;
    //         const output = URL.createObjectURL(new Blob([data]))
    //         console.log('ready', data)
    //     }),
    //     print: Comlink.proxyValue(function (data) {
    //         console.log(data);
    //         stdout += data + "\n";
    //     }),
    //     printErr: Comlink.proxyValue(function (data) {
    //         console.log('error', data);
    //         stderr += data + "\n";
    //     }),
    //     postRun: Comlink.proxyValue(function (result) {
    //         console.log('DONE', result);
    //     }),
    //     postRunCallback: Comlink.proxyValue(function (result) {
    //         console.log('DONE', result);
    //     }),
    //     onExit: Comlink.proxyValue(function (code) {
    //         console.log("Process exited with code " + code);
    //         console.log(stdout);
    //     }),
    //     exit: Comlink.proxyValue(function (code) {
    //         console.log("Process exited with code " + code);
    //         console.log(stdout);
    //     }),
    // });
    //
    // console.log(result);
}

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
