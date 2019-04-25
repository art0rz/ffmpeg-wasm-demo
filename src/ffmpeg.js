export async function ffmpeg(file, progressCallback) {
    const buf = await new Response(file).arrayBuffer();
    const ffmpegjs = new Worker('/ffmpeg-worker.js');

    return new Promise((resolve) => {
        ffmpegjs.addEventListener('message', (event) => {
            switch (event.data.type) {
                case 'init': {
                    ffmpegjs.postMessage({
                        type: 'encode',
                        data: {
                            fileName: file.name,
                            buffer: buf,
                            options: [
                                "-c:v",
                                "libx264",
                                "-preset",
                                "slower",
                                "-crf",
                                "21",
                                "-c:a",
                                "aac",
                                "-b:a",
                                "96k",
                                "-pix_fmt",
                                "yuv420p",
                                "-profile:v",
                                "high",
                                "-level",
                                "4.1",
                                "-movflags",
                                "faststart",
                                "-vf",
                                "scale=-1:404",
                            ]
                        }
                    });
                    break;
                }
                case 'done': {
                    resolve(event.data.data);
                    break;
                }
                case 'progress': {
                    progressCallback(event.data.data);
                    break;
                }
            }
        })
    })
}