importScripts('https://cdn.jsdelivr.net/npm/comlinkjs@3.0.2/umd/comlink.js');
importScripts('/ffmpeg-worker-mp4.js');

addEventListener('message', (event) => {
    switch (event.data.type) {
        case 'encode': {
            aconv({
                arguments: [
                    '-y',
                    '-i',
                    event.data.data.fileName,
                    ...event.data.data.options,
                    'output.mp4'
                ],
                MEMFS: [{name: event.data.data.fileName, data: event.data.data.buffer}],
                postRunCallback: (res) => {
                    postMessage({type: 'done', data: res.MEMFS[0].data})
                }
            });

        }
    }
});

postMessage({type: 'init', data: {}});

