const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => document.querySelectorAll(sel);

const tagReader = window.jsmediatags;

const searchText = qs('.search.text'); // the search term text box

const clearSearch = qs(`.clear.search`);
const searchArtist = qs('.search.artist'); // radio buttons
const searchAlbum = qs('.search.album');
const searchSong = qs('.search.song');

const audio = qs('audio.track'); // audio element
const albumCover = qs('.album-cover'); // current album cover (./folder.jpg)
const currentSong = qs('.current.song'); // current song information
const timeOverview = qs('.time-overview'); // play time

const play = qs('.control.play'); // media controls
const pause = qs('.control.pause');
const previous = qs('.control.previous');
const next = qs('.control.next');
const shuffle = qs('.control.shuffle');
const progress = qs('.progress');

const menu = qs('.menu.view'); // 3 dot menu to the left
const toggleMenu = qs('.toggle.menu');
const menuOpens = qsa('.menu.open');

const playlist = qs('.playlist'); // the playlist/search-results itself

class MusicPlayer {
  #loaded = []; // list of all files
  #loadedIndex = -1; // loaded index
  
  #current = []; // currently displayed list of files
  #currentIndex = -1; // current index

  #albumCovers = new Map();

  #paused = false;
  #shuffling = false;

  constructor(){
    toggleMenu.addEventListener('click', this.toggleMenu);
    menuOpens.forEach(
      mo => mo.addEventListener('click', this.loadDirectory.bind(this)));

    play.addEventListener('click', () => this.play());
    pause.addEventListener('click', () => this.pauseTrack());
    previous.addEventListener('click', () => this.previousTrack());
    next.addEventListener('click', () => this.nextTrack());
    shuffle.addEventListener('click', () => this.toggleShuffling());

    navigator.mediaSession.setActionHandler('play', () => this.play());
    navigator.mediaSession.setActionHandler('pause', () => this.pauseTrack());
    navigator.mediaSession.setActionHandler('previoustrack', () => this.previousTrack());
    navigator.mediaSession.setActionHandler('nexttrack', () => this.nextTrack());

    audio.addEventListener('durationchange', () => audio.duration ? progress.max = audio.duration : null);
    audio.addEventListener('timeupdate', () => {
      progress.value = audio.currentTime;
      
      const currentTime = this.formatSeconds(audio.currentTime);
      const totalTime = this.formatSeconds(audio.duration);
      
      timeOverview.value = `${currentTime}/${totalTime}`;    
    });
    audio.addEventListener('ended', () => this.nextTrack());

    searchText.addEventListener('keyup', () => this.search());
    searchArtist.addEventListener('change', () => this.search());
    searchAlbum.addEventListener('change', () => this.search());
    searchSong.addEventListener('change', () => this.search());
    clearSearch.addEventListener('click', () => this.clearSearch());

    progress.addEventListener('click', (e) => {
      const width = progress.offsetWidth;
      const click = e.offsetX;
      const fraction = click / width;
      audio.currentTime = audio.duration * fraction;
    })
  }

  clearSearch(){
    searchText.value = "";
    this.search();
  }

  toggleShuffling(){
    if(this.#shuffling){
      shuffle.classList.remove('active');
      this.#shuffling = false;
    }else{
      shuffle.classList.add('active');
      this.#shuffling = true;
    }
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

                  file.label  = label;
                  file.artist = tags.artist;
                  file.year   = tags.year;
                  file.album  = tags.album;
                  file.cd     = tags.TPOS?.data;
                  file.track  = tags.track;
                  file.title  = tags.title;
                  
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
    const currentlyPlaying = this.#current[this.#currentIndex];
    this.#current = this.#loaded
      .filter(file => file[property]?.toLowerCase()?.includes(text))
      .sort(this.sortingFn);
    this.#currentIndex = this.#current.indexOf(currentlyPlaying) ?? 0;      
    this.#updatePlaylist();
    playlist
      .querySelector(`[data-current-index="${this.#currentIndex}"]`)
      ?.scrollIntoView({block: "start", inline: "nearest", behavior: 'smooth'});
  }

  sortingFn(a, b){
    if(a.artist !== b.artist){
      if(a.artist.toLowerCase() < b.artist.toLowerCase()) return -1;
      if(a.artist.toLowerCase() > b.artist.toLowerCase()) return 1;
    }
    if(a.year !== b.year){
      return parseInt(a.year) - parseInt(b.year);
    }
    if(a.album !== b.album){
      if(a.album < b.album) return -1;
      if(a.album > b.album) return 1;
    }
    if(a.cd !== b.cd){
      try{
        return parseInt(a.cd) - parseInt(b.cd);
      }catch(_){
        if(a.cd < b.cd) return -1;
        if(a.cd > b.cd) return 1;
      }
    }
    if(a.track !== b.track){
      try{
        return parseInt(a.track) - parseInt(b.track);
      }catch(_){
        if(a.track < b.track) return -1;
        if(a.track > b.track) return 1;
      }
    }
    if(a.title !== b.title){
      if(a.title < b.title) return -1;
      if(a.title > b.title) return 1;
    }
    return 0;
  }

  #updatePlaylist(){
    let current;
    playlist.innerHTML = '';
    let i = 0;
    for(const file of this.#current){
      const entry = document.createElement('li');

      entry.dataset.label   = file.label;
      entry.dataset.artist  = file.artist;
      entry.dataset.year    = file.year;
      entry.dataset.album   = file.album;
      entry.dataset.cd      = file.cd;
      entry.dataset.track   = file.track;
      entry.dataset.title   = file.title;
      file.currentIndex     = playlist.children.length
      entry.dataset.currentIndex = playlist.children.length;
      entry.dataset.loadedIndex = file.loadedIndex;

      if(entry.dataset.loadedIndex == this.#loadedIndex){
        entry.innerText = `${this.#paused ? '⏸︎' : '⏵︎'}${entry.dataset.label}`;
        current = entry;
      }else{
        entry.innerText = entry.dataset.label;
      }

      entry.addEventListener('dblclick', () => this.#playTrack(entry));
      playlist.appendChild(entry);
    }

    current?.scrollIntoView({block: "start", inline: "nearest", behavior: "smooth"});
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

  setSearch(term, type){
    searchText.value = term;
    document.querySelector(`.search.option:checked`).checked = false;
    document.querySelector(`.search.option[value=${type}]`).checked = true;
    this.search();
  }

  #playTrack(entry){
    const currentlyPlaying = playlist.querySelector(`[data-current-index="${this.#currentIndex}"]`);
    if(currentlyPlaying) currentlyPlaying.innerText = currentlyPlaying.dataset.label;

    this.#currentIndex = parseInt(entry.dataset.currentIndex);
    this.#loadedIndex = parseInt(entry.dataset.loadedIndex);

    // set currentSong()
    this.setCurrentSong(entry);

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
      albumCover.src = './img/Initial Cover.jpg';
    }
  }

  setCurrentSong(entry) {
    currentSong.innerHTML = '';

    const artistLabel = document.createElement('label');
    artistLabel.innerText = entry.dataset.artist ?? "Unknown Artist";
    artistLabel.addEventListener('click', () => this.setSearch(entry.dataset.artist, 'artist'));
    currentSong.appendChild(artistLabel);

    const albumLabel = document.createElement('label');
    if(entry.dataset.album && entry.dataset.album !== "undefined"){
      albumLabel.innerText = entry.dataset.album ? ` - ${entry.dataset.album}` : "";
      albumLabel.addEventListener('click', () => this.setSearch(entry.dataset.album, 'album'));
      currentSong.appendChild(albumLabel);
    }

    const trackLabel = document.createElement('label');
    if(entry.dataset.track && entry.dataset.track !== "undefined"){
      trackLabel.innerText = entry.dataset.track ? ` - ${entry.dataset.track}` : ``;
      currentSong.appendChild(trackLabel);
    }

    const songLabel = document.createElement('label');
    songLabel.innerText = ` - ${entry.dataset.title ?? "Unknown Song"}`;
    currentSong.appendChild(songLabel);
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
    let ntn;
    if(!this.#shuffling){
      const ctn = parseInt(this.#currentIndex);
      ntn = ctn + 1;
    }else{
      ntn = Math.floor(Math.random() * this.#current.length);
    }
    const nextTrack = playlist.querySelector(`li[data-current-index="${ntn}"]`);

    if(this.#shuffling) nextTrack.scrollIntoView({block: "start", inline: "nearest", behavior: 'smooth'})
    this.#playTrack(nextTrack);
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
