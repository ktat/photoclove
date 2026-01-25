import WelcomeImage from "../WelcomeImage.jsx";

function NavigationIcons({
  updateCurrentDate,
  resetPhotoState,
  toggleHome,
  setWelcomeImage,
  toggleSearchPage,
  toggleImporter,
  toggleAlbumListMode,
  openTagsList,
  openFacesList,
  openTrash,
  handleMouseEnter,
  handleMouseLeave,
  config
}) {
  return (
    <div className="navigation-icons">
      <a href="#" onClick={() => {
        updateCurrentDate("");
        resetPhotoState();
        toggleHome();
        setWelcomeImage(WelcomeImage(config));
      }}
      onMouseEnter={(e) => handleMouseEnter("HOME", e)}
      onMouseLeave={handleMouseLeave}>🏠</a>

      <a href="#" onClick={() => {
        toggleSearchPage(true, "", true);
      }}
      onMouseEnter={(e) => handleMouseEnter("Search", e)}
      onMouseLeave={handleMouseLeave}>🔍</a>

      <a href="#" onClick={() => toggleImporter(true)}
      onMouseEnter={(e) => handleMouseEnter("Import", e)}
      onMouseLeave={handleMouseLeave}>📥</a>

      <a href="#" onClick={() => {
        resetPhotoState();
        toggleAlbumListMode();
      }}
      onMouseEnter={(e) => handleMouseEnter("Albums", e)}
      onMouseLeave={handleMouseLeave}>📚</a>

      <a href="#" onClick={() => {
        resetPhotoState();
        openTagsList();
      }}
      onMouseEnter={(e) => handleMouseEnter("Tags", e)}
      onMouseLeave={handleMouseLeave}>🏷️</a>

      <a href="#" onClick={() => {
        resetPhotoState();
        openFacesList();
      }}
      onMouseEnter={(e) => handleMouseEnter("Faces", e)}
      onMouseLeave={handleMouseLeave}>👤</a>

      <a href="#" onClick={() => {
        resetPhotoState();
        openTrash();
      }}
      onMouseEnter={(e) => handleMouseEnter("Trash", e)}
      onMouseLeave={handleMouseLeave}>🗑️</a>
    </div>
  );
}

export default NavigationIcons;
