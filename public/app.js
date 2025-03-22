// Background animation with Three.js
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Three.js
    const canvas = document.getElementById('background-canvas');
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true
    });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 10;
    
    // Create a dreamy gradient background with new color palette
    const createDreamyBackground = () => {
        const geometry = new THREE.PlaneGeometry(50, 50, 32, 32);
        
        // Create shader material with dreamy effects
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
            },
            vertexShader: `
                varying vec2 vUv;
                
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform vec2 resolution;
                varying vec2 vUv;
                
                // Simplex-like noise function
                vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
                
                float snoise(vec2 v) {
                    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                                     -0.577350269189626, 0.024390243902439);
                    vec2 i  = floor(v + dot(v, C.yy));
                    vec2 x0 = v -   i + dot(i, C.xx);
                    vec2 i1;
                    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                    vec4 x12 = x0.xyxy + C.xxzz;
                    x12.xy -= i1;
                    i = mod289(i);
                    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                                   + i.x + vec3(0.0, i1.x, 1.0));
                    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
                                          dot(x12.zw, x12.zw)), 0.0);
                    m = m*m;
                    m = m*m;
                    vec3 x = 2.0 * fract(p * C.www) - 1.0;
                    vec3 h = abs(x) - 0.5;
                    vec3 ox = floor(x + 0.5);
                    vec3 a0 = x - ox;
                    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
                    vec3 g;
                    g.x  = a0.x  * x0.x  + h.x  * x0.y;
                    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
                    return 130.0 * dot(m, g);
                }
                
                void main() {
                    // NEW COLOR PALETTE - deep teal, cyan, and warm orange/gold
                    vec3 color1 = vec3(0.1, 0.4, 0.5); // Deep teal
                    vec3 color2 = vec3(0.0, 0.7, 0.8); // Bright cyan
                    vec3 color3 = vec3(0.9, 0.6, 0.2); // Warm gold/orange
                    
                    // Time variables for different animation speeds
                    float t1 = time * 0.1;
                    float t2 = time * 0.05;
                    
                    // Create dreamy noise patterns
                    float noise1 = snoise(vUv * 2.0 + vec2(t1, t2));
                    float noise2 = snoise(vUv * 3.0 - vec2(t2, t1 * 0.5));
                    
                    // Soft wave patterns
                    float wave1 = sin(vUv.x * 5.0 + t1) * 0.5 + 0.5;
                    float wave2 = sin(vUv.y * 4.0 - t2) * 0.5 + 0.5;
                    
                    // Combine waves with noise for dreamy effect
                    float blend1 = mix(wave1, noise1 * 0.5 + 0.5, 0.7);
                    float blend2 = mix(wave2, noise2 * 0.5 + 0.5, 0.6);
                    
                    // Create smooth circular gradients that move slowly
                    vec2 center1 = vec2(0.5 + 0.2 * sin(t1), 0.5 + 0.2 * cos(t1 * 0.7));
                    vec2 center2 = vec2(0.5 - 0.3 * cos(t2 * 0.8), 0.5 - 0.3 * sin(t2 * 0.6));
                    
                    float circle1 = smoothstep(0.8, 0.0, length(vUv - center1) * 2.0);
                    float circle2 = smoothstep(1.0, 0.0, length(vUv - center2) * 1.8);
                    
                    // Combine all effects for final dreamy blend
                    vec3 finalColor = mix(
                        mix(color1, color2, blend1),
                        color3,
                        circle1 * 0.6
                    );
                    
                    finalColor = mix(
                        finalColor,
                        mix(color2, color3, blend2),
                        circle2 * 0.5
                    );
                    
                    // Add subtle, dreamy glow effects
                    float glow = 0.03 / (0.4 + length(vUv - center1) * 3.0) * (sin(time * 0.5) * 0.5 + 0.5);
                    glow += 0.02 / (0.3 + length(vUv - center2) * 2.0) * (cos(time * 0.4) * 0.5 + 0.5);
                    
                    // New cyan glow accent
                    finalColor += vec3(0.0, 0.9, 1.0) * glow * 1.8;
                    
                    // Soften the overall effect with a slight blur effect
                    finalColor = mix(
                        finalColor,
                        vec3(0.0, 0.4, 0.5),
                        noise1 * noise2 * 0.1
                    );
                    
                    gl_FragColor = vec4(finalColor, 0.9);
                }
            `,
            transparent: true
        });
        
        const plane = new THREE.Mesh(geometry, material);
        scene.add(plane);
        
        return material;
    };
    
    // Initialize elements
    const dreamyMaterial = createDreamyBackground();
        
    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        dreamyMaterial.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
    });
    
    // Animation loop
    const animate = () => {
        requestAnimationFrame(animate);
        
        // Update shader time
        dreamyMaterial.uniforms.time.value += 0.01;
        
        
        // Render scene
        renderer.render(scene, camera);
    };
    
    animate();

    addEventListeners();
});

const API_BASE_URL = 'http://localhost:3000/api';
let currentVideoUrl = null;
let ffmpeg = null;
let availableFormats = [];

// Initialize FFmpeg
async function initFFmpeg() {
    if (ffmpeg) return ffmpeg;
    
    ffmpeg = new FFmpeg.createFFmpeg({ 
        log: true,
        progress: ({ ratio }) => {
            const percent = Math.round(ratio * 100);
            if (percent > 0) {
                document.getElementById('progressBar').style.width = `${percent}%`;
                document.getElementById('progressBar').textContent = `${percent}%`;
            }
        }
    });
    
    document.getElementById('statusText').textContent = "Loading FFmpeg...";
    await ffmpeg.load();
    document.getElementById('statusText').textContent = "FFmpeg loaded!";
    
    return ffmpeg;
}

function fetchVideoInfo() {
    const videoUrl = document.getElementById('videoUrl').value.trim();
    currentVideoUrl = videoUrl;
    const errorMsg = document.getElementById('errorMsg');
    const videoInfoContainer = document.getElementById('videoInfoContainer');
    const loader = document.getElementById('loader');
    
    if (!videoUrl) {
        errorMsg.textContent = "Please enter a YouTube URL";
        errorMsg.style.display = "block";
        return;
    }
    
    // Show loader, hide error and previous results
    loader.style.display = "block";
    errorMsg.style.display = "none";
    videoInfoContainer.style.display = "none";
    
    // Fetch video info from our API
    fetch(`${API_BASE_URL}/info?url=${encodeURIComponent(videoUrl)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch video info');
            }
            return response.json();
        })
        .then(data => {
            // Store available formats
            availableFormats = data.formats || [];
            
            // Hide loader
            loader.style.display = "none";
            
            // Set video details
            document.getElementById('videoTitle').textContent = data.title;
            document.getElementById('videoAuthor').textContent = `By: ${data.author}`;
            document.getElementById('videoDuration').textContent = `Duration: ${formatDuration(data.lengthSeconds)}`;
            document.getElementById('videoViews').textContent = `Views: ${Number(data.viewCount).toLocaleString()}`;
            document.getElementById('thumbnailPreview').src = data.thumbnail;
            
            // Get available formats
            return fetch(`${API_BASE_URL}/formats?url=${encodeURIComponent(videoUrl)}`);
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch available formats');
            }
            return response.json();
        })
        .then(formatData => {
            // Populate quality dropdown with available qualities
            const qualitySelect = document.getElementById('videoQuality');
            qualitySelect.innerHTML = ''; // Clear existing options
            
            // If no qualities available, add default options
            if (!formatData.qualities || formatData.qualities.length === 0) {
                qualitySelect.innerHTML = `
                    <option value="1080p">1080p (Full HD)</option>
                    <option value="720p">720p (HD)</option>
                    <option value="480p">480p</option>
                    <option value="360p">360p</option>
                `;
            } else {
                // Add available qualities
                formatData.qualities.forEach(quality => {
                    const option = document.createElement('option');
                    option.value = quality;
                    
                    // Check if this is HD, Full HD or better
                    let qualityLabel = quality;
                    if (parseInt(quality) >= 2160) {
                        qualityLabel = `${quality} (4K)`;
                    } else if (parseInt(quality) >= 1440) {
                        qualityLabel = `${quality} (2K)`;
                    } else if (parseInt(quality) >= 1080) {
                        qualityLabel = `${quality} (Full HD)`;
                    } else if (parseInt(quality) >= 720) {
                        qualityLabel = `${quality} (HD)`;
                    }
                    
                    option.textContent = qualityLabel;
                    qualitySelect.appendChild(option);
                });
            }
            
            // Update codec options based on available quality
            updateCodecOptions();
            
            // Initialize FFmpeg
            initFFmpeg().catch(error => {
                console.error('FFmpeg load error:', error);
                errorMsg.textContent = "Failed to load FFmpeg: " + error.message;
                errorMsg.style.display = "block";
            });
            
            // Show video info container
            videoInfoContainer.style.display = "block";
        })
        .catch(error => {
            loader.style.display = "none";
            errorMsg.textContent = error.message;
            errorMsg.style.display = "block";
        });
}

function updateCodecOptions() {
    const quality = document.getElementById('videoQuality').value;
    const codecSelect = document.getElementById('videoCodec');
    codecSelect.innerHTML = ''; // Clear existing options
    
    // Get the numeric resolution from the quality string (e.g., "1080p" -> 1080)
    const resolution = parseInt(quality);
    
    // Set available codecs based on resolution
    if (resolution >= 2160) {
        // 4K - All codecs available, AV1 recommended
        addCodecOption(codecSelect, 'av1', 'AV1 (Best quality/size)', true);
        addCodecOption(codecSelect, 'vp9', 'VP9 (Good compatibility)');
        addCodecOption(codecSelect, 'h264', 'H.264 (Highest compatibility)');
    } else if (resolution >= 1080) {
        // 1080p/1440p - All codecs available, VP9 as default
        addCodecOption(codecSelect, 'vp9', 'VP9 (Recommended)', true);
        addCodecOption(codecSelect, 'av1', 'AV1 (Best quality/size)');
        addCodecOption(codecSelect, 'h264', 'H.264 (Highest compatibility)');
    } else if (resolution >= 720) {
        // 720p - All codecs, H.264 as default
        addCodecOption(codecSelect, 'h264', 'H.264 (Recommended)', true);
        addCodecOption(codecSelect, 'vp9', 'VP9');
        addCodecOption(codecSelect, 'av1', 'AV1');
    } else {
        // Less than 720p - Only H.264 recommended
        addCodecOption(codecSelect, 'h264', 'H.264 (Recommended)', true);
        addCodecOption(codecSelect, 'vp9', 'VP9');
    }
    
    // Update file size after codec options are set
    updateFileSize();
}


function addCodecOption(selectElement, value, text, selected = false) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    if (selected) option.selected = true;
    selectElement.appendChild(option);
}

async function updateFileSize() {
    const videoUrl = currentVideoUrl;
    const quality = document.getElementById('videoQuality').value;
    const codec = document.getElementById('videoCodec').value;
    const fileSizeDisplay = document.getElementById('fileSizeDisplay');
    
    if (!videoUrl) return;
    
    // Show loading indicator
    fileSizeDisplay.textContent = 'Calculating size...';
    fileSizeDisplay.style.display = 'block';
    
    try {
        // Fetch file size estimate from API
        const response = await fetch(`${API_BASE_URL}/estimate-size?url=${encodeURIComponent(videoUrl)}&quality=${quality}&codec=${codec}`);
        
        if (!response.ok) {
            throw new Error('Failed to get file size');
        }
        
        const data = await response.json();
        
        // Format file size for display
        let formattedSize;
        if (data.sizeInBytes < 1024 * 1024) {
            formattedSize = `${(data.sizeInBytes / 1024).toFixed(2)} KB`;
        } else if (data.sizeInBytes < 1024 * 1024 * 1024) {
            formattedSize = `${(data.sizeInBytes / (1024 * 1024)).toFixed(2)} MB`;
        } else {
            formattedSize = `${(data.sizeInBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
        }
        
        // Update UI with file size
        fileSizeDisplay.textContent = `Estimated size: ${formattedSize}`;
    } catch (error) {
        console.error('Error fetching file size:', error);
        fileSizeDisplay.textContent = 'Size information unavailable';
    }
}

function addEventListeners() {
    document.getElementById('videoCodec').addEventListener('change', updateFileSize);
    document.getElementById('videoQuality').addEventListener('change', function() {
        updateCodecOptions();
        // Note: No need to call updateFileSize here as it's called at the end of updateCodecOptions
    });
}

async function startDownload() {
    if (!currentVideoUrl) return;
    
    const quality = document.getElementById('videoQuality').value;
    const codec = document.getElementById('videoCodec').value;
    document.getElementById('downloadVideoBtn').disabled = true;
    document.getElementById('downloadAudioBtn').disabled = true;
    document.getElementById('progressContainer').style.display = 'block';
    document.getElementById('statusText').textContent = "Preparing download...";
    
    try {
        // Make sure FFmpeg is loaded
        await initFFmpeg();
        
        // Get separate video and audio streams
        document.getElementById('statusText').textContent = "Fetching streams...";
        
        // Add codec parameter to the URL
        const apiUrl = `${API_BASE_URL}/separate-streams?url=${encodeURIComponent(currentVideoUrl)}&quality=${quality}&codec=${codec}`;
        const response = await fetch(apiUrl);
        
        if (!response.ok) throw new Error('Failed to get stream information');
        
        const streamInfo = await response.json();
        const videoTitle = streamInfo.title.replace(/[^\w\s]/gi, '_');
        
        // Download video stream
        document.getElementById('statusText').textContent = `Downloading ${codec.toUpperCase()} video stream...`;
        const videoResponse = await fetch(`${API_BASE_URL}/get-stream?url=${encodeURIComponent(currentVideoUrl)}&formatId=${streamInfo.videoFormatId}`);
        if (!videoResponse.ok) throw new Error('Failed to download video stream');
        
        const videoData = await videoResponse.arrayBuffer();
        ffmpeg.FS('writeFile', 'input_video.mp4', new Uint8Array(videoData));
        
        // Download audio stream
        document.getElementById('statusText').textContent = "Downloading audio stream...";
        const audioResponse = await fetch(`${API_BASE_URL}/get-stream?url=${encodeURIComponent(currentVideoUrl)}&formatId=${streamInfo.audioFormatId}`);
        if (!audioResponse.ok) throw new Error('Failed to download audio stream');
        
        const audioData = await audioResponse.arrayBuffer();
        ffmpeg.FS('writeFile', 'input_audio.mp4', new Uint8Array(audioData));
        
        // Merge streams using FFmpeg
        document.getElementById('statusText').textContent = "Merging video and audio...";
        await ffmpeg.run(
            '-i', 'input_video.mp4', 
            '-i', 'input_audio.mp4',
            '-c:v', 'copy',
            '-c:a', 'aac',
            'output.mp4'
        );
        
        // Download the merged file
        document.getElementById('statusText').textContent = "Preparing download...";
        const data = ffmpeg.FS('readFile', 'output.mp4');
        
        // Create a download link
        const blob = new Blob([data.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${videoTitle}_${quality}_${codec}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Clean up
        URL.revokeObjectURL(url);
        ffmpeg.FS('unlink', 'input_video.mp4');
        ffmpeg.FS('unlink', 'input_audio.mp4');
        ffmpeg.FS('unlink', 'output.mp4');
        
        document.getElementById('statusText').textContent = "Download complete!";
    } catch (error) {
        console.error('Download error:', error);
        document.getElementById('statusText').textContent = "Error: " + error.message;
    } finally {
        document.getElementById('downloadVideoBtn').disabled = false;
        document.getElementById('downloadAudioBtn').disabled = false;
    }
}

function downloadAudio() {
    if (!currentVideoUrl) return;
    
    const videoUrl = currentVideoUrl;
    const downloadUrl = `${API_BASE_URL}/download?url=${encodeURIComponent(videoUrl)}&format=audio`;
    window.location.href = downloadUrl;
}

function formatDuration(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    let result = '';
    if (hrs > 0) {
        result += `${hrs}:${mins.toString().padStart(2, '0')}:`;
    } else {
        result += `${mins}:`;
    }
    result += secs.toString().padStart(2, '0');
    
    return result;
}
