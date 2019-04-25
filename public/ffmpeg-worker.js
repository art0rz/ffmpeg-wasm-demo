importScripts('https://cdn.jsdelivr.net/npm/comlinkjs@3.0.2/umd/comlink.js');
importScripts('/ffmpeg-worker-mp4.js');

let stderr = [''];

const DURATION_REGEXP = /\s+Duration: (\d{2}:\d{2}:\d{2}.\d{2})/i;
const PROGRESS_DURATION_REGEXP = /\s+time=(\d{2}:\d{2}:\d{2}.\d{2})/i;

function parseDuration(durationString) {
    const [days, hours, minutes] = durationString.split(':');

    const durationSeconds = (parseInt(days, 10) * 86400) + (parseInt(hours, 10) * 3600) + (parseFloat(minutes, 10) * 60);

    return durationSeconds;
}

let duration = 0;

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
                stderr: (d) => {
                    if (String.fromCharCode(d) === '\n') {
                        const line = stderr[Math.max(0, stderr.length - 1)];
                        stderr.push('');

                        if (DURATION_REGEXP.test(line) === true) {
                            duration = parseDuration(DURATION_REGEXP.exec(line)[1]);
                        } else if (PROGRESS_DURATION_REGEXP.test(line) === true) {
                            const progress = parseDuration(PROGRESS_DURATION_REGEXP.exec(line)[1]);
                            postMessage({type: 'progress', data: progress / duration});
                        }
                    } else {
                        stderr[stderr.length - 1] += String.fromCharCode(d);
                    }
                },
                MEMFS: [{name: event.data.data.fileName, data: event.data.data.buffer}],
                postRunCallback: (res) => {
                    console.log(stderr);
                    postMessage({type: 'done', data: res.MEMFS[0].data})
                }
            });

        }
    }
});

postMessage({type: 'init', data: {}});

