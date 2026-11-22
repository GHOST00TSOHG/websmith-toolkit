import {Config} from '@remotion/cli/config';
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setConcurrency(4);
// Use the system Chrome if Remotion's headless shell can't be downloaded:
// Config.setBrowserExecutable('/usr/bin/google-chrome');
