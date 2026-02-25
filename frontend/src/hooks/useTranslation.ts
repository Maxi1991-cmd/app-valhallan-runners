import i18n from '../i18n';

export const useTranslation = () => {
  const t = (key: string, options?: Record<string, any>) => {
    return i18n.t(key, options);
  };

  return { t, i18n };
};

export default useTranslation;
