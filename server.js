// In your server.js file
const express = require('express');
const cors = require('cors');
const app = express();
const os = require('os');
const PORT = process.env.PORT || 3000;
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { v4: uuidv4 } = require('uuid');


app.use((req, res, next) => {
    res.header('Cross-Origin-Opener-Policy', 'same-origin');
    res.header('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
  });

// Setup middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const cookiesPath = path.join(__dirname, 'cookies.txt');

// Save cookies from environment variable (if present)
if (process.env.YT_COOKIES) {
    console.log("🔹 Writing cookies to file...");
    fs.writeFileSync(cookiesPath, process.env.YT_COOKIES, 'utf8');
} else {
    console.error("❌ No YT_COOKIES environment variable found!");
}


// Check if youtube-dl or yt-dlp is installed
app.get('/api/info', async (req, res) => {
    try {
      const videoURL = req.query.url;
      
      if (!videoURL) {
        return res.status(400).json({ error: 'Video URL is required' });
      }
  
      // Use yt-dlp (or youtube-dl) to get video info
      const { stdout, stderr } = await execAsync(
        `yt-dlp --cookies-from-browser chrome -j "${videoURL}"`
    );
    

    if (stderr) console.error(`⚠️ yt-dlp stderr:`, stderr);
      const info = JSON.parse(stdout);
      
      // Format the response
      const videoDetails = {
        videoId: info.id,
            title: info.title,
            author: info.uploader,
            lengthSeconds: info.duration,
            viewCount: info.view_count,
            thumbnail: info.thumbnail,
            formats: info.formats.map(format => ({
                format_id: format.format_id,
                quality: format.height ? `${format.height}p` : format.format_note,
                resolution: format.resolution,
                fps: format.fps,
                hasVideo: format.vcodec !== 'none',
                hasAudio: format.acodec !== 'none',
                filesize: format.filesize,
                vcodec: format.vcodec
        }))
      };
  
      res.json(videoDetails);
    } catch (error) {
      console.error('Error fetching video info:', error);
      res.status(500).json({ error: 'Failed to fetch video information', details: error.message });
    }
});

// Improved API to get available formats with all qualities
app.get('/api/formats', async (req, res) => {
    try {
      const videoURL = req.query.url;
      
      if (!videoURL) {
        return res.status(400).json({ error: 'Video URL is required' });
      }
  
      // Use yt-dlp to get formats
      const { stdout } = await execAsync(`yt-dlp -j "${videoURL}"`);
      const info = JSON.parse(stdout);
      
      // Extract all available qualities from video formats
      const videoFormats = info.formats.filter(format => 
        format.vcodec !== 'none' && format.height
      );
      
      // Get unique resolutions
      const uniqueHeights = new Set();
      videoFormats.forEach(format => {
        if (format.height) {
          uniqueHeights.add(format.height);
        }
      });
      
      // Get available codecs
      const availableCodecs = new Set();
      videoFormats.forEach(format => {
        if (format.vcodec) {
          // Simplified codec identification
          if (format.vcodec.includes('avc1') || format.vcodec.includes('h264')) {
            availableCodecs.add('h264');
          } else if (format.vcodec.includes('av01') || format.vcodec.includes('av1')) {
            availableCodecs.add('av1');
          } else if (format.vcodec.includes('vp9')) {
            availableCodecs.add('vp9');
          }
        }
      });
      
      // Convert set to array and sort in descending order
      const qualities = Array.from(uniqueHeights).sort((a, b) => b - a);
      
      res.json({
        qualities: qualities.map(height => `${height}p`),
        hasAudio: info.formats.some(f => f.acodec !== 'none'),
        bestQuality: qualities.length > 0 ? `${qualities[0]}p` : '1080p',
        availableCodecs: Array.from(availableCodecs)
      });
      
    } catch (error) {
      console.error('Error fetching formats:', error);
      res.status(500).json({ error: 'Failed to fetch video formats', details: error.message });
    }
});

// Download video
app.get('/api/download', async (req, res) => {
    try {
      const { url, quality, format } = req.query;
      
      if (!url) {
        return res.status(400).json({ error: 'Video URL is required' });
      }
  
      // Get video info for title
      const { stdout: infoStr } = await execAsync(`yt-dlp -j "${url}"`);
      const info = JSON.parse(infoStr);
      
      // Create safe filename
      const sanitizedTitle = info.title.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_');
      let fileExtension = format === 'audio' ? 'mp3' : 'mp4';
      
      // Set appropriate headers
      res.header('Content-Disposition', `attachment; filename="${sanitizedTitle}.${fileExtension}"`);
      
      let ytdlProcess;
      
      if (format === 'audio') {
        // Download best audio only
        res.header('Content-Type', 'audio/mp3');
        
        ytdlProcess = spawn('yt-dlp', [
          '-f', 'bestaudio', 
          url, 
          '-o', '-', 
          '--audio-format', 'mp3', 
          '--audio-quality', '0'
        ]);
        
        ytdlProcess.stdout.pipe(res);
      } 
      else {
        // For video with audio - specify both video and audio formats
        let videoQuality = '1080';
        if (quality) {
          videoQuality = quality.replace('p', '');
        }
        
        res.header('Content-Type', 'video/mp4');
        
        // Use format selector to find best video+audio combo for requested quality
        // This uses yt-dlp's ability to mux streams without ffmpeg
        ytdlProcess = spawn('yt-dlp', [
          '-f', `bestvideo[height<=${videoQuality}]+bestaudio`,
          '--no-check-certificate',  // Helps with some HTTP-based muxing
          '--prefer-free-formats',   // Prefer formats that are easier to mux
          url,
          '-o', '-'
        ]);
        
        ytdlProcess.stdout.pipe(res);
      }
      
      // Handle errors
      ytdlProcess.stderr.on('data', (data) => {
        console.error(`yt-dlp stderr: ${data}`);
      });
      
      ytdlProcess.on('error', (error) => {
        console.error('Error executing yt-dlp:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to download video', details: error.message });
        }
      });
      
      // Handle client disconnection
      req.on('close', () => {
        if (ytdlProcess && !ytdlProcess.killed) {
          ytdlProcess.kill();
          console.log('Download canceled - client disconnected');
        }
      });
      
    } catch (error) {
      console.error('Error downloading:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to download video', details: error.message });
      }
    }
});

// Add this new endpoint to server.js - now with better support for higher resolutions and codec selection
app.get('/api/separate-streams', async (req, res) => {
    try {
      const { url, quality, codec } = req.query;
      
      if (!url) {
        return res.status(400).json({ error: 'Video URL is required' });
      }
  
      let videoQuality = '1080';
      if (quality) {
        videoQuality = quality.replace('p', '');
      }
  
      // Get all available formats
      const { stdout } = await execAsync(`yt-dlp -j "${url}"`);
      const info = JSON.parse(stdout);
      
      // Define codec matcher function based on requested codec
      const matchesCodec = (formatCodec) => {
        if (!codec) return true; // If no codec specified, match any
        
        switch (codec.toLowerCase()) {
          case 'h264':
            return formatCodec.includes('avc1') || formatCodec.includes('h264');
          case 'av1':
            return formatCodec.includes('av01') || formatCodec.includes('av1');
          case 'vp9':
            return formatCodec.includes('vp9');
          default:
            return true;
        }
      };
      
      // Find best video-only format for the requested quality and codec
      let videoFormats = info.formats.filter(f => 
        f.vcodec !== 'none' && 
        f.height <= parseInt(videoQuality) && 
        (f.acodec === 'none' || f.audio_channels === 0) &&
        matchesCodec(f.vcodec)
      ).sort((a, b) => b.height - a.height || b.tbr - a.tbr);
      
      // If no format found with the specific codec, try without codec filter if it wasn't explicitly requested
      if (videoFormats.length === 0 && codec) {
        console.log(`No formats found with codec ${codec}, trying any codec`);
        videoFormats = info.formats.filter(f => 
          f.vcodec !== 'none' && 
          f.height <= parseInt(videoQuality) && 
          (f.acodec === 'none' || f.audio_channels === 0)
        ).sort((a, b) => b.height - a.height || b.tbr - a.tbr);
      }
      
      // If still no format found, get any video format at or below requested quality
      if (videoFormats.length === 0) {
        videoFormats = info.formats.filter(f => 
            f.vcodec !== 'none' && 
            f.height <= parseInt(videoQuality)
          ).sort((a, b) => b.height - a.height || b.tbr - a.tbr);
        }
        
        // Find best audio-only format
        const audioFormats = info.formats.filter(f => 
          f.vcodec === 'none' && f.acodec !== 'none'
        ).sort((a, b) => b.abr - a.abr || b.tbr - a.tbr);
        
        if (videoFormats.length === 0 || audioFormats.length === 0) {
          return res.status(404).json({ 
            error: 'No suitable video or audio formats found',
            videoFormatsFound: videoFormats.length,
            audioFormatsFound: audioFormats.length
          });
        }
        
        const bestVideoFormat = videoFormats[0];
        const bestAudioFormat = audioFormats[0];
        
        res.json({
          title: info.title,
          videoFormatId: bestVideoFormat.format_id,
          audioFormatId: bestAudioFormat.format_id,
          videoCodec: bestVideoFormat.vcodec,
          audioCodec: bestAudioFormat.acodec,
          videoHeight: bestVideoFormat.height,
          videoWidth: bestVideoFormat.width,
        });
        
      } catch (error) {
        console.error('Error getting separate streams:', error);
        res.status(500).json({ error: 'Failed to get stream information', details: error.message });
      }
  });
  
  // Endpoint to get a specific stream by format ID
  app.get('/api/get-stream', async (req, res) => {
      try {
        const { url, formatId } = req.query;
        
        if (!url || !formatId) {
          return res.status(400).json({ error: 'URL and format ID are required' });
        }
        
        // Stream the specific format directly to the client
        const ytdlProcess = spawn('yt-dlp', [
          '-f', formatId,
          '--no-check-certificate',
          url,
          '-o', '-'
        ]);
        
        ytdlProcess.stdout.pipe(res);
        
        // Handle errors
        ytdlProcess.stderr.on('data', (data) => {
          console.error(`yt-dlp stderr: ${data}`);
        });
        
        ytdlProcess.on('error', (error) => {
          console.error('Error executing yt-dlp:', error);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to get stream', details: error.message });
          }
        });
        
        // Handle client disconnection
        req.on('close', () => {
          if (ytdlProcess && !ytdlProcess.killed) {
            ytdlProcess.kill();
            console.log('Stream request canceled - client disconnected');
          }
        });
        
      } catch (error) {
        console.error('Error getting stream:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to get stream', details: error.message });
        }
      }
  });
  
  // Add a health check endpoint
  app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', message: 'Server is running' });
  });
  
  // Check if yt-dlp is installed
  app.get('/api/check-dependencies', async (req, res) => {
      try {
          // Check yt-dlp
          await execAsync('yt-dlp --version');
          const ytdlpInstalled = true;
          
          // Additional checks could be added here
          
          res.json({
              ytdlp: ytdlpInstalled,
              system: {
                  platform: process.platform,
                  memory: Math.round(os.totalmem() / (1024 * 1024 * 1024)) + 'GB',
                  cores: os.cpus().length
              }
          });
      } catch (error) {
          console.error('Dependency check failed:', error);
          res.status(500).json({ 
              error: 'Dependency check failed', 
              details: error.message,
              ytdlp: false
          });
      }
  });
  
  app.get('/api/estimate-size', async (req, res) => {
    try {
        const { url, quality, codec } = req.query;
        
        if (!url) {
            return res.status(400).json({ error: 'Video URL is required' });
        }
        
        let videoQuality = '1080';
        if (quality) {
            videoQuality = quality.replace('p', '');
        }
        
        // Get all available formats
        const { stdout } = await execAsync(`yt-dlp -j "${url}"`);
        const info = JSON.parse(stdout);
        
        // Define codec matcher function based on requested codec
        const matchesCodec = (formatCodec) => {
            if (!codec) return true; // If no codec specified, match any
            
            switch (codec.toLowerCase()) {
                case 'h264':
                    return formatCodec.includes('avc1') || formatCodec.includes('h264');
                case 'av1':
                    return formatCodec.includes('av01') || formatCodec.includes('av1');
                case 'vp9':
                    return formatCodec.includes('vp9');
                default:
                    return true;
            }
        };
        
        // Find best video format for the requested quality and codec
        let videoFormats = info.formats.filter(f => 
            f.vcodec !== 'none' && 
            f.height <= parseInt(videoQuality) && 
            (f.acodec === 'none' || f.audio_channels === 0) &&
            matchesCodec(f.vcodec)
        ).sort((a, b) => b.height - a.height || b.tbr - a.tbr);
        
        // If no format found with the specific codec, try without codec filter
        if (videoFormats.length === 0 && codec) {
            videoFormats = info.formats.filter(f => 
                f.vcodec !== 'none' && 
                f.height <= parseInt(videoQuality) && 
                (f.acodec === 'none' || f.audio_channels === 0)
            ).sort((a, b) => b.height - a.height || b.tbr - a.tbr);
        }
        
        // Find best audio-only format
        const audioFormats = info.formats.filter(f => 
            f.vcodec === 'none' && f.acodec !== 'none'
        ).sort((a, b) => b.abr - a.abr || b.tbr - a.tbr);
        
        if (videoFormats.length === 0 || audioFormats.length === 0) {
            return res.status(404).json({ 
                error: 'No suitable video or audio formats found',
                sizeInBytes: 0
            });
        }
        
        const bestVideoFormat = videoFormats[0];
        const bestAudioFormat = audioFormats[0];
        
        // Calculate total size - use filesize if available, otherwise use bitrate estimation
        let totalSizeBytes = 0;
        
        // Video size calculation
        if (bestVideoFormat.filesize) {
          totalSizeBytes += bestVideoFormat.filesize;
        } else if (bestVideoFormat.filesize_approx) {
          totalSizeBytes += bestVideoFormat.filesize_approx;
        } else if (bestVideoFormat.tbr) {
          // Normalize bitrate calculations with reasonable bitrate caps for each codec
          let bitrate = bestVideoFormat.tbr;
          
          // Apply reasonable bitrate caps based on codec and resolution
          if (bestVideoFormat.vcodec.includes('avc1') || bestVideoFormat.vcodec.includes('h264')) {
              // H.264 usually has higher bitrate
              bitrate = Math.min(bitrate, 5000); // Cap at 5Mbps for 1080p H.264
          } else if (bestVideoFormat.vcodec.includes('vp9')) {
              bitrate = Math.min(bitrate, 2500); // VP9 is more efficient
          } else if (bestVideoFormat.vcodec.includes('av01') || bestVideoFormat.vcodec.includes('av1')) {
              bitrate = Math.min(bitrate, 2000); // AV1 is even more efficient
          }
          
          // Ensure bitrate is in kbps
          if (bitrate > 50000) { // If bitrate seems to be in bps instead of kbps
              bitrate = bitrate / 1000;
          }
          
          // Calculate with normalized bitrate (kbps * seconds / 8 = KB)
          const videoSizeKB = (bitrate * info.duration) / 8;
          totalSizeBytes += videoSizeKB * 1024;
        }
        
        // Audio size calculation
        if (bestAudioFormat.filesize) {
          totalSizeBytes += bestAudioFormat.filesize;
        } else if (bestAudioFormat.filesize_approx) {
          totalSizeBytes += bestAudioFormat.filesize_approx;
        } else if (bestAudioFormat.abr || bestAudioFormat.tbr) {
          // Use abr (audio bitrate) if available, otherwise use tbr (total bitrate)
          let bitrate = bestAudioFormat.abr || bestAudioFormat.tbr;
          
          // Most YouTube audio is 128kbps or 192kbps max
          bitrate = Math.min(bitrate, 192);
          
          // Ensure bitrate is in kbps
          if (bitrate > 1000) { // If bitrate seems to be in bps
              bitrate = bitrate / 1000;
          }
          
          const audioSizeKB = (bitrate * info.duration) / 8;
          totalSizeBytes += audioSizeKB * 1024;
        }
        
        // Add a small overhead for container format 
        totalSizeBytes = Math.round(totalSizeBytes * 1.02);
        
        res.json({
            sizeInBytes: totalSizeBytes,
            videoHeight: bestVideoFormat.height,
            videoCodec: bestVideoFormat.vcodec,
            audioCodec: bestAudioFormat.acodec
        });
        
    } catch (error) {
        console.error('Error estimating file size:', error);
        res.status(500).json({ 
            error: 'Failed to estimate file size', 
            details: error.message,
            sizeInBytes: 0
        });
    }
});

  // Serve the main page
  app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
  
  // Start the server
  app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Access the application at http://localhost:${PORT}`);
  });
  
  // Graceful shutdown
  process.on('SIGINT', () => {
      console.log('Server shutting down...');
      // Clean up any temporary files or resources here if needed
      process.exit(0);
  });