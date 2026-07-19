// MOCK DATA - Pour preview navigateur uniquement
// Supprimer ce fichier et la ligne <script> dans index.html pour la prod

(function() {
  const hasTauri = !!(window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke);
  if (hasTauri) return;

  console.log("[DEMO] Mode mock actif - fonctionnalités réelles désactivées");

  const eventListeners = {};

  window.__TAURI__ = {
    core: {
      invoke: async (cmd, args) => {
        if (cmd === "search_videos") {
          await new Promise(r => setTimeout(r, 1200));
          return MOCK_VIDEOS;
        }
        if (cmd === "get_video_info") {
          await new Promise(r => setTimeout(r, 800));
          return MOCK_VIDEOS[0];
        }
        if (cmd === "get_playlist") {
          await new Promise(r => setTimeout(r, 1000));
          return MOCK_VIDEOS.slice(0, 24);
        }
        if (cmd === "get_file_size") {
          await new Promise(r => setTimeout(r, 800));
          return (Math.random() * 80 + 20).toFixed(1) + " Mo";
        }
        if (cmd === "get_download_dir") return "~/Downloads/YoutubeDownloader";
        if (cmd === "check_dir_exists") return true;
        if (cmd === "check_network") return true;
        if (cmd === "pick_folder") return "~/Downloads/YoutubeDownloader";
        if (cmd === "download_video") {
          const id = args.id;
          let percent = 0;
          const speedBase = 1.5 + Math.random() * 3;
          const interval = setInterval(() => {
            percent += Math.random() * 12 + 3;
            const speed = (speedBase + Math.random()).toFixed(1) + ' Mo/s';
            const eta = Math.max(0, Math.round((100 - percent) / 5)) + 's';
            if (percent >= 100) {
              percent = 100;
              clearInterval(interval);
              emitEvent("download-progress", {
                id, percent: 100, status: "finished", speed: '', eta: '', filename: "", error: ""
              });
            } else {
              emitEvent("download-progress", {
                id, percent, status: "downloading", speed, eta, filename: "", error: ""
              });
            }
          }, 400);
          return;
        }
        if (cmd === "cancel_download") return;
        if (cmd === "pause_download") return;
        if (cmd === "update_ytdlp") return "already_up_to_date";
        if (cmd === "open_in_browser") {
          window.open(args.url, "_blank");
          return;
        }
        throw new Error(`Commande mock non implémentée: ${cmd}`);
      }
    },
    event: {
      listen: async (event, callback) => {
        if (!eventListeners[event]) eventListeners[event] = [];
        eventListeners[event].push(callback);
        return () => {
          eventListeners[event] = eventListeners[event].filter(cb => cb !== callback);
        };
      },
      emit: (event, payload) => emitEvent(event, payload)
    }
  };

  function emitEvent(event, payload) {
    if (eventListeners[event]) {
      for (const cb of eventListeners[event]) {
        cb({ payload });
      }
    }
  }

  const MOCK_VIDEOS = [
    { title: "Rick Astley - Never Gonna Give You Up", author: "Rick Astley", duration: "3:33", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg", filesize: "45.2 Mo" },
    { title: "PSY - GANGNAM STYLE M/V", author: "officialpsy", duration: "4:13", url: "https://www.youtube.com/watch?v=9bZkp7q19f0", thumbnail: "https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg", filesize: "52.8 Mo" },
    { title: "Luis Fonsi - Despacito ft. Daddy Yankee", author: "Luis Fonsi", duration: "4:42", url: "https://www.youtube.com/watch?v=kJQP7kiw5Fk", thumbnail: "https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg", filesize: "58.1 Mo" },
    { title: "Ed Sheeran - Shape of You", author: "Ed Sheeran", duration: "3:53", url: "https://www.youtube.com/watch?v=JGwWNGJdvx8", thumbnail: "https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg", filesize: "41.6 Mo" },
    { title: "Wiz Khalifa - See You Again ft. Charlie Puth", author: "Wiz Khalifa", duration: "3:58", url: "https://www.youtube.com/watch?v=RgKAFK5djSk", thumbnail: "https://i.ytimg.com/vi/RgKAFK5djSk/hqdefault.jpg", filesize: "44.3 Mo" },
    { title: "Queen - Bohemian Rhapsody (Official Video Remastered)", author: "Queen Official", duration: "5:55", url: "https://www.youtube.com/watch?v=fJ9rUzIMcZQ", thumbnail: "https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg", filesize: "72.9 Mo" },
    { title: "Mark Ronson - Uptown Funk ft. Bruno Mars", author: "Mark Ronson", duration: "4:30", url: "https://www.youtube.com/watch?v=OPf0YbXqDm0", thumbnail: "https://i.ytimg.com/vi/OPf0YbXqDm0/hqdefault.jpg", filesize: "55.0 Mo" },
    { title: "OneRepublic - Counting Stars", author: "OneRepublic", duration: "4:17", url: "https://www.youtube.com/watch?v=hT_nvWreIhg", thumbnail: "https://i.ytimg.com/vi/hT_nvWreIhg/hqdefault.jpg", filesize: "49.7 Mo" },
    { title: "Shakira - Waka Waka (This Time for Africa)", author: "Shakira", duration: "3:31", url: "https://www.youtube.com/watch?v=pRpeEdMmmQ0", thumbnail: "https://i.ytimg.com/vi/pRpeEdMmmQ0/hqdefault.jpg", filesize: "38.4 Mo" },
    { title: "Katy Perry - Roar", author: "Katy Perry", duration: "3:43", url: "https://www.youtube.com/watch?v=CevxZvSJLk8", thumbnail: "https://i.ytimg.com/vi/CevxZvSJLk8/hqdefault.jpg", filesize: "40.1 Mo" },
    { title: "Maroon 5 - Sugar", author: "Maroon 5", duration: "3:55", url: "https://www.youtube.com/watch?v=09R8_2nJtjg", thumbnail: "https://i.ytimg.com/vi/09R8_2nJtjg/hqdefault.jpg", filesize: "43.5 Mo" },
    { title: "Bruno Mars - 24K Magic", author: "Bruno Mars", duration: "3:33", url: "https://www.youtube.com/watch?v=JRfuAukYTKg", thumbnail: "https://i.ytimg.com/vi/JRfuAukYTKg/hqdefault.jpg", filesize: "39.8 Mo" },
    { title: "Taylor Swift - Shake It Off", author: "Taylor Swift", duration: "3:39", url: "https://www.youtube.com/watch?v=nfWlot6h_JM", thumbnail: "https://i.ytimg.com/vi/nfWlot6h_JM/hqdefault.jpg", filesize: "41.2 Mo" },
    { title: "Justin Bieber - Sorry", author: "Justin Bieber", duration: "3:20", url: "https://www.youtube.com/watch?v=fRh_vgS2dFE", thumbnail: "https://i.ytimg.com/vi/fRh_vgS2dFE/hqdefault.jpg", filesize: "36.7 Mo" },
    { title: "Adele - Hello", author: "Adele", duration: "4:45", url: "https://www.youtube.com/watch?v=YQHsXMglC9A", thumbnail: "https://i.ytimg.com/vi/YQHsXMglC9A/hqdefault.jpg", filesize: "59.3 Mo" },
    { title: "Lady Gaga - Bad Romance", author: "Lady Gaga", duration: "4:54", url: "https://www.youtube.com/watch?v=qrO4YZeyl0I", thumbnail: "https://i.ytimg.com/vi/qrO4YZeyl0I/hqdefault.jpg", filesize: "61.8 Mo" },
    { title: "Eminem - Lose Yourself", author: "Eminem", duration: "5:26", url: "https://www.youtube.com/watch?v=_Yhyp-_hX2s", thumbnail: "https://i.ytimg.com/vi/_Yhyp-_hX2s/hqdefault.jpg", filesize: "67.4 Mo" },
    { title: "Coldplay - Viva La Vida", author: "Coldplay", duration: "4:02", url: "https://www.youtube.com/watch?v=dvgZkm1xWPE", thumbnail: "https://i.ytimg.com/vi/dvgZkm1xWPE/hqdefault.jpg", filesize: "46.9 Mo" },
    { title: "Imagine Dragons - Believer", author: "Imagine Dragons", duration: "3:25", url: "https://www.youtube.com/watch?v=7wtfhZwyrcc", thumbnail: "https://i.ytimg.com/vi/7wtfhZwyrcc/hqdefault.jpg", filesize: "37.5 Mo" },
    { title: "Billie Eilish - bad guy", author: "Billie Eilish", duration: "3:14", url: "https://www.youtube.com/watch?v=DyDfgMOUjCI", thumbnail: "https://i.ytimg.com/vi/DyDfgMOUjCI/hqdefault.jpg", filesize: "35.1 Mo" },
    { title: "Post Malone - Rockstar ft. 21 Savage", author: "Post Malone", duration: "3:38", url: "https://www.youtube.com/watch?v=0yWST0sNJCk", thumbnail: "https://i.ytimg.com/vi/0yWST0sNJCk/hqdefault.jpg", filesize: "40.8 Mo" },
    { title: "Drake - God's Plan", author: "Drake", duration: "3:19", url: "https://www.youtube.com/watch?v=x9ekH0Xru4o", thumbnail: "https://i.ytimg.com/vi/x9ekH0Xru4o/hqdefault.jpg", filesize: "36.3 Mo" },
    { title: "Dua Lipa - Don't Start Now", author: "Dua Lipa", duration: "3:03", url: "https://www.youtube.com/watch?v=oygrmJFFYZs", thumbnail: "https://i.ytimg.com/vi/oygrmJFFYZs/hqdefault.jpg", filesize: "33.9 Mo" },
    { title: "The Weeknd - Blinding Lights", author: "The Weeknd", duration: "3:20", url: "https://www.youtube.com/watch?v=4NRXx6U8ABQ", thumbnail: "https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg", filesize: "37.2 Mo" },
    { title: "Harry Styles - Watermelon Sugar", author: "Harry Styles", duration: "2:54", url: "https://www.youtube.com/watch?v=E07s5ZYygMg", thumbnail: "https://i.ytimg.com/vi/E07s5ZYygMg/hqdefault.jpg", filesize: "32.4 Mo" },
    { title: "Sia - Cheap Thrills ft. Sean Paul", author: "Sia", duration: "3:44", url: "https://www.youtube.com/watch?v=nYh-nv-GURU", thumbnail: "https://i.ytimg.com/vi/nYh-nv-GURU/hqdefault.jpg", filesize: "42.0 Mo" },
    { title: "Halsey - Without Me", author: "Halsey", duration: "3:22", url: "https://www.youtube.com/watch?v=ACEG02W9xQk", thumbnail: "https://i.ytimg.com/vi/ACEG02W9xQk/hqdefault.jpg", filesize: "37.8 Mo" },
    { title: "Travis Scott - SICKO MODE ft. Drake", author: "Travis Scott", duration: "5:12", url: "https://www.youtube.com/watch?v=6ONRf7hvkMw", thumbnail: "https://i.ytimg.com/vi/6ONRf7hvkMw/hqdefault.jpg", filesize: "65.2 Mo" },
    { title: "Cardi B - Bodak Yellow", author: "Cardi B", duration: "3:43", url: "https://www.youtube.com/watch?v=PEG41K5wveY", thumbnail: "https://i.ytimg.com/vi/PEG41K5wveY/hqdefault.jpg", filesize: "42.6 Mo" },
    { title: "Kendrick Lamar - HUMBLE.", author: "Kendrick Lamar", duration: "2:57", url: "https://www.youtube.com/watch?v=tvTRZJ-4EyI", thumbnail: "https://i.ytimg.com/vi/tvTRZJ-4EyI/hqdefault.jpg", filesize: "33.1 Mo" },
    { title: "Skrillex - Bangarang ft. Sirah", author: "Skrillex", duration: "3:35", url: "https://www.youtube.com/watch?v=YJV6ldFGAs0", thumbnail: "https://i.ytimg.com/vi/YJV6ldFGAs0/hqdefault.jpg", filesize: "40.3 Mo" },
    { title: "Avicii - Wake Me Up", author: "Avicii", duration: "4:07", url: "https://www.youtube.com/watch?v=IcrbM1l_BoI", thumbnail: "https://i.ytimg.com/vi/IcrbM1l_BoI/hqdefault.jpg", filesize: "47.5 Mo" },
    { title: "Calvin Harris - Summer", author: "Calvin Harris", duration: "3:44", url: "https://www.youtube.com/watch?v=kN3cjV5d5Zc", thumbnail: "https://i.ytimg.com/vi/kN3cjV5d5Zc/hqdefault.jpg", filesize: "42.8 Mo" },
    { title: "David Guetta - Titanium ft. Sia", author: "David Guetta", duration: "3:48", url: "https://www.youtube.com/watch?v=JRfuAukYTKg", thumbnail: "https://i.ytimg.com/vi/JRfuAukYTKg/hqdefault.jpg", filesize: "43.2 Mo" },
    { title: "Marshmello - Alone", author: "Marshmello", duration: "3:17", url: "https://www.youtube.com/watch?v=ALZHF5UqnYW", thumbnail: "https://i.ytimg.com/vi/ALZHF5UqnYW/hqdefault.jpg", filesize: "36.0 Mo" },
    { title: "Martin Garrix - Animals", author: "Martin Garrix", duration: "5:03", url: "https://www.youtube.com/watch?v=K_yBUfMGvzc", thumbnail: "https://i.ytimg.com/vi/K_yBUfMGvzc/hqdefault.jpg", filesize: "63.7 Mo" },
    { title: "Deadmau5 - Strobe (Official Video)", author: "deadmau5", duration: "10:37", url: "https://www.youtube.com/watch?v=tKi9Zhv6UWs", thumbnail: "https://i.ytimg.com/vi/tKi9Zhv6UWs/hqdefault.jpg", filesize: "128.4 Mo" },
    { title: "Daft Punk - Get Lucky ft. Pharrell Williams", author: "Daft Punk", duration: "4:08", url: "https://www.youtube.com/watch?v=5y2FuDPGGcU", thumbnail: "https://i.ytimg.com/vi/5y2FuDPGGcU/hqdefault.jpg", filesize: "48.1 Mo" },
    { title: "Kygo - Firestone ft. Conrad Sewell", author: "Kygo", duration: "4:12", url: "https://www.youtube.com/watch?v=9vMh9f41tEA", thumbnail: "https://i.ytimg.com/vi/9vMh9f41tEA/hqdefault.jpg", filesize: "49.0 Mo" },
    { title: "Clean Bandit - Rather Be ft. Jess Glynne", author: "Clean Bandit", duration: "3:47", url: "https://www.youtube.com/watch?v=B-mTq5tqpmc", thumbnail: "https://i.ytimg.com/vi/B-mTq5tqpmc/hqdefault.jpg", filesize: "43.7 Mo" },
    { title: "Lil Nas X - Old Town Road", author: "Lil Nas X", duration: "1:53", url: "https://www.youtube.com/watch?v=7ys_fGm48FU", thumbnail: "https://i.ytimg.com/vi/7ys_fGm48FU/hqdefault.jpg", filesize: "21.4 Mo" },
    { title: "Olivia Rodrigo - drivers license", author: "Olivia Rodrigo", duration: "4:02", url: "https://www.youtube.com/watch?v=ZmNSg7EBBX0", thumbnail: "https://i.ytimg.com/vi/ZmNSg7EBBX0/hqdefault.jpg", filesize: "46.2 Mo" },
    { title: "Doja Cat - Say So", author: "Doja Cat", duration: "3:22", url: "https://www.youtube.com/watch?v=pok8H_KF1Bo", thumbnail: "https://i.ytimg.com/vi/pok8H_KF1Bo/hqdefault.jpg", filesize: "38.6 Mo" },
    { title: "Megan Thee Stallion - Savage", author: "Megan Thee Stallion", duration: "2:49", url: "https://www.youtube.com/watch?v=U94pE6O3sKk", thumbnail: "https://i.ytimg.com/vi/U94pE6O3sKk/hqdefault.jpg", filesize: "31.9 Mo" },
    { title: "Jack Harlow - WHATS POPPIN", author: "Jack Harlow", duration: "2:19", url: "https://www.youtube.com/watch?v=pRpeEdMmmQ0", thumbnail: "https://i.ytimg.com/vi/pRpeEdMmmQ0/hqdefault.jpg", filesize: "26.3 Mo" },
    { title: "Bad Bunny - Dakiti ft. Jhay Cortez", author: "Bad Bunny", duration: "3:25", url: "https://www.youtube.com/watch?v=mejDxW6xkSU", thumbnail: "https://i.ytimg.com/vi/mejDxW6xkSU/hqdefault.jpg", filesize: "39.1 Mo" },
    { title: "ROSALIA - DESPECHA ft. ROSALÍA", author: "ROSALIA", duration: "2:57", url: "https://www.youtube.com/watch?v=XxL0x1eHg3M", thumbnail: "https://i.ytimg.com/vi/XxL0x1eHg3M/hqdefault.jpg", filesize: "33.5 Mo" },
    { title: "Glass Animals - Heat Waves", author: "Glass Animals", duration: "3:59", url: "https://www.youtube.com/watch?v=mRD0-GxKnBk", thumbnail: "https://i.ytimg.com/vi/mRD0-GxKnBk/hqdefault.jpg", filesize: "45.8 Mo" },
    { title: "Måneskin - ZITTI E BUONI", author: "Måneskin Official", duration: "3:32", url: "https://www.youtube.com/watch?v=Q4hfa4Z6r9s", thumbnail: "https://i.ytimg.com/vi/Q4hfa4Z6r9s/hqdefault.jpg", filesize: "39.4 Mo" },
  ];
})();
