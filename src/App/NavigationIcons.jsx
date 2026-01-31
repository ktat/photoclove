import { useTranslation } from 'react-i18next';
import WelcomeImage, { getMemoriesStartupImage } from "../WelcomeImage.jsx";

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
  setShowInsightsModal,
  handleMouseEnter,
  handleMouseLeave,
  config
}) {
  const { t } = useTranslation('common');

  const handleHomeClick = async () => {
    updateCurrentDate("");
    resetPhotoState();
    toggleHome();

    // Handle memories mode
    const mode = config?.startup_images?.mode;
    if (mode === 'memories') {
      const memoriesImage = await getMemoriesStartupImage();
      if (memoriesImage) {
        setWelcomeImage(memoriesImage);
      } else {
        // Fallback based on user preference
        const fallback = config?.startup_images?.memories_fallback || 'default';
        if (fallback === 'custom') {
          setWelcomeImage(WelcomeImage({ ...config, startup_images: { ...config.startup_images, mode: 'custom' } }));
        } else {
          setWelcomeImage(WelcomeImage(null));
        }
      }
    } else {
      setWelcomeImage(WelcomeImage(config));
    }
  };

  return (
    <div className="navigation-icons">
      <a href="#" onClick={handleHomeClick}
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

      <a href="#" onClick={() => setShowInsightsModal(true)}
      onMouseEnter={(e) => handleMouseEnter(t('navigation.insights'), e)}
      onMouseLeave={handleMouseLeave}>📊</a>
    </div>
  );
}

export default NavigationIcons;
