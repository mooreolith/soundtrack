const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => document.querySelectorAll(sel);

const tagReader = window.jsmediatags;

const searchText = qs('.search.text');

const audio = qs('audio.track');
const albumCover = qs('.album-cover');
const currentSong = qs('.current.song');
const timeOverview = qs('.time-overview');

const play = qs('.control.play');
const pause = qs('.control.pause');
const previous = qs('.control.previous');
const next = qs('.control.next');
const progress = qs('.progress');

const menu = qs('.menu.view');
const toggleMenu = qs('.toggle.menu');
const menuOpens = qsa('.menu.open');

const playlist = qs('.playlist');


class MusicPlayer {
  #loaded = []; // list of all files
  #loadedIndex = -1; // loaded index
  
  #current = []; // currently displayed list of files
  #currentIndex = -1; // current index

  #albumCovers = new Map();

  #paused = false;

  constructor(){
    toggleMenu.addEventListener('click', this.toggleMenu);
    menuOpens.forEach(
      mo => mo.addEventListener('click', this.loadDirectory.bind(this)));

    play.addEventListener('click', () => this.play());
    pause.addEventListener('click', () => this.pauseTrack());
    previous.addEventListener('click', () => this.previousTrack());
    next.addEventListener('click', () => this.nextTrack());

    audio.addEventListener('durationchange', () => audio.duration ? progress.max = audio.duration : null);
    audio.addEventListener('timeupdate', () => {
      progress.value = audio.currentTime;
      
      const currentTime = this.formatSeconds(audio.currentTime);
      const totalTime = this.formatSeconds(audio.duration);
      
      timeOverview.value = `${currentTime}/${totalTime}`;    
    });
    audio.addEventListener('ended', () => this.nextTrack());

    searchText.addEventListener('keyup', () => {
      this.search();
      this.#updatePlaylist();
    });
  }

  formatSeconds(s){
    s = parseInt(s);
    let hours = Math.floor(s / 3600);
    let minutes = Math.floor((s - (hours * 3600)) / 60);
    let seconds = s - (hours * 3600) - (minutes * 60);

    if(hours < 10) hours = "0" + hours;
    if(minutes < 10) minutes = "0" + minutes;
    if(seconds < 10) seconds = "0" + seconds;

    return `${hours !== "00" ? hours + ":" : ""}${minutes}:${seconds}`;
  }

  loadDirectory(){
    const input = document.createElement('input');
    input.type = 'file';
    // input.accept = 'audio/*';
    input.setAttributeNode(document.createAttribute('webkitdirectory'));
    input.setAttributeNode(document.createAttribute('multiple'));

    input.addEventListener('change', () => {
      Promise.all(Array
        .from(input.files)
        .map(async (file, i) => {
          if(file.name.endsWith('folder.jpg')){
            let path = file.webkitRelativePath.split('/').slice(0, -1).join('/');
            this.#albumCovers.set(path, file);
          }else if(file.name.endsWith('.mp3')){
            return await new Promise((resolve, reject) => {
              tagReader.read(file, {
                onSuccess: (result) => {
                  const tags = result.tags;
                  const label = `${tags.artist ? `${tags.artist}` : "Unknown Artist"}${tags.album ? ` - ${tags.album}` : ""}${tags.track ? ` - ${tags.track}` : ""}${tags.title ? ` - ${tags.title}` : " - Unknown Song"}`;

                  file.label = label;
                  file.artist = tags.artist;
                  file.album = tags.album;
                  file.track = tags.track;
                  file.title = tags.title;
                  
                  file.loadedIndex = this.#loaded.length;
                  this.#loaded.push(file);

                  resolve(file);
                },
                onError: (error) => {
                  file.label = file.name;

                  file.loadedIndex = this.#loaded.length;
                  this.#loaded.push(file);

                  resolve(file);
                }
              });
            })
          }
        })
      ).then(() => {
        this.#current = this.#loaded
          .filter(() => true)
          .sort(this.sortingFn);
        this.#updatePlaylist();    
      });
    });

    if('showPicker' in HTMLInputElement.prototype){
      input.showPicker();
    }else{
      input.click();
    }
  }

  search(){
    const text = searchText.value.toLowerCase();
    const property = document.querySelector('.search.option:checked').value;
    this.#current = this.#loaded
      .filter(file => file[property]?.toLowerCase()?.includes(text))
      .sort(this.sortingFn);
  }

  sortingFn(a, b){
    if(a.artist < b.artist) return -1;
    if(a.artist > b.artist) return 1;
    if(a.album < b.album) return -1;
    if(a.album > b.album) return 1;
    if(parseInt(a.track) < parseInt(b.track)) return -1;
    if(parseInt(a.track) > parseInt(b.track)) return 1;
    if(a.title < b.title) return -1;
    if(a.title > b.title) return 1;
    return 0;
  }

  #updatePlaylist(){
    playlist.innerHTML = '';
    let i = 0;
    for(const file of this.#current){
      const entry = document.createElement('li');

      entry.dataset.label = file.label;
      entry.dataset.artist = file.artist;
      entry.dataset.album = file.album;
      entry.dataset.track = file.track;
      entry.dataset.title = file.title;
      file.currentIndex = playlist.children.length
      entry.dataset.currentIndex = playlist.children.length;
      entry.dataset.loadedIndex = file.loadedIndex;

      if(entry.dataset.loadedIndex == this.#loadedIndex){
        entry.innerText = `${this.#paused ? '⏸︎' : '⏵︎'}${entry.dataset.label}`;
      }else{
        entry.innerText = entry.dataset.label;
      }

      entry.addEventListener('dblclick', () => this.#playTrack(entry));
      playlist.appendChild(entry);      
    }
  }

  play(){
    if(!this.#paused){
      if(playlist.children.length > 0){
        const track = playlist.children[0];
        this.#playTrack(track);
      }
    }

    if(this.#paused){
      this.continueTrack();
    }
  }

  #playTrack(entry){
    const currentlyPlaying = playlist.querySelector(`[data-current-index="${this.#currentIndex}"]`);
    if(currentlyPlaying) currentlyPlaying.innerText = currentlyPlaying.dataset.label;

    this.#currentIndex = parseInt(entry.dataset.currentIndex);
    this.#loadedIndex = parseInt(entry.dataset.loadedIndex);
    currentSong.innerText = entry.dataset.label;

    // audio
    const trackReader = new FileReader();
    trackReader.onload = () => {
      progress.value = 0.0;
      audio.src = trackReader.result;
      audio.play();
      this.#togglePlayPause('play');
    }

    const track = this.#current.find(trackFile => trackFile.currentIndex === parseInt(entry.dataset.currentIndex));
    entry.innerText = `⏵︎ ${entry.dataset.label}`;
    trackReader.readAsDataURL(track);

    // image
    try{
      const path = track.webkitRelativePath.split('/').slice(0, -1).join('/');
      const coverFile = this.#albumCovers.get(path);
      
      const imgReader = new FileReader();
      imgReader.onload = () => {
        albumCover.src = imgReader.result;
      }
      imgReader.readAsDataURL(coverFile);
    }catch(e){
      albumCover.src = './Initial Cover.jpg';
    }
  }

  pauseTrack(){
    audio.pause();
    this.#paused = true;
    this.#togglePlayPause('pause');
  }

  continueTrack(){
    audio.play();
    this.#paused = false;
    this.#togglePlayPause('play');
  }

  previousTrack(){
    if(audio.currentTime >= 1.0){
      audio.currentTime = 0;
    }else{
      const ctn = parseInt(this.#currentIndex);
      const ptn = ctn - 1;
      const previousTrack = playlist.querySelector(`li[data-current-index="${ptn}"]`);
      if(previousTrack) this.#playTrack(previousTrack);
    }
  }

  nextTrack(){
    const ctn = parseInt(this.#currentIndex);
    const ntn = ctn + 1;
    const nextTrack = playlist.querySelector(`li[data-current-index="${ntn}"]`);
    if(next) this.#playTrack(nextTrack);
  }

  toggleMenu(){
    menu.classList.toggle('hide');
  }

  #togglePlayPause(state='play'){
    const entry = playlist.querySelector(`[data-current-index="${this.#currentIndex}"]`);
    const label = entry.dataset.label;

    if(state === 'play'){
      play.hidden = true;
      pause.hidden = false;
      entry.innerText = `⏵︎ ${label}`;
    }

    if(state === 'pause'){
      play.hidden = false;
      pause.hidden = true;
      entry.innerText = `⏸︎ ${label}`;
    }
  }
}

const mp = new MusicPlayer();
