declare module '@ffmpeg-installer/ffmpeg' {
  const ffmpeg: {
    path: string;
  };
  export default ffmpeg;
}

declare module '@ffprobe-installer/ffprobe' {
  const ffprobe: {
    path: string;
  };
  export default ffprobe;
}

declare module 'ffmpeg-static' {
  const ffmpegPath: string | null;
  export default ffmpegPath;
}

declare module 'ffprobe-static' {
  const ffprobe: {
    path: string;
  };
  export default ffprobe;
}
