import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('common');

  return (
    <div className="navigation-icons">
      <a href="#" onClick={() => {
        updateCurrentDate("");
        resetPhotoState();
        toggleHome();
        setWelcomeImage(WelcomeImage(config));
      }}
      onMouseEnter={(e) => handleMouseEnter(t('navigation.home'), e)}
      onMouseLeave={handleMouseLeave}>🏠</a>

      <a href="#" onClick={() => {
        toggleSearchPage(true, "", true);
      }}
      onMouseEnter={(e) => handleMouseEnter(t('navigation.search'), e)}
      onMouseLeave={handleMouseLeave}>🔍</a>

      <a href="#" onClick={() => toggleImporter(true)}
      onMouseEnter={(e) => handleMouseEnter(t('navigation.import'), e)}
      onMouseLeave={handleMouseLeave}>📥</a>

      <a href="#" onClick={() => {
        resetPhotoState();
        toggleAlbumListMode();
      }}
      onMouseEnter={(e) => handleMouseEnter(t('navigation.albums'), e)}
      onMouseLeave={handleMouseLeave}>📚</a>

      <a href="#" onClick={() => {
        resetPhotoState();
        openTagsList();
      }}
      onMouseEnter={(e) => handleMouseEnter(t('navigation.tags'), e)}
      onMouseLeave={handleMouseLeave}>🏷️</a>

      <a href="#" onClick={() => {
        resetPhotoState();
        openFacesList();
      }}
      onMouseEnter={(e) => handleMouseEnter(t('navigation.people'), e)}
      onMouseLeave={handleMouseLeave}>👤</a>

      <a href="#" onClick={() => {
        resetPhotoState();
        openTrash();
      }}
      onMouseEnter={(e) => handleMouseEnter(t('navigation.trash'), e)}
      onMouseLeave={handleMouseLeave}>🗑️</a>
    </div>
  );
}

export default NavigationIcons;
