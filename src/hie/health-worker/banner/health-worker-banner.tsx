import React, { useEffect, useMemo, useState } from 'react';
import { showSnackbar, useSession } from '@openmrs/esm-framework';
import { getProviderByUuid } from '../../../shared/provider.resource';
import { searchPractitioner } from '../../hie-resource';
import {
  type TagType,
  type PractitionerMessage,
  type PractitionerSearchParams,
  type PractitionerLicense,
} from '../../../types';
import styles from './health-worker-banner.scss';
import { Button, InlineLoading, Tag } from '@carbon/react';
import HealthWorkerModal from '../modal/health-worker-details.modal';
import { getTagType } from '../../../shared/utils/get-tag-type';
interface HealthWorkerBannerProps {}
const HealthWorkerBanner: React.FC<HealthWorkerBannerProps> = () => {
  const [practitioner, setPractitioner] = useState<PractitionerMessage>();
  const [displayDetailsModal, setDisplayDetailsModal] = useState<boolean>();
  const [loading, setLoading] = useState<boolean>(false);
  const session = useSession();
  const locationUuid = session.sessionLocation.uuid;
  const latestLicense = useMemo(() => getLatestLicense(), [practitioner]);

  useEffect(() => {
    getProviderDetails();
  }, []);

  async function getProviderDetails(refresh?: boolean) {
    setLoading(true);
    const providerUuid = session.currentProvider.uuid;
    const provider = await getProviderByUuid(providerUuid);
    const { nationalId, licenseNo } = getProviderAttributes(provider);
    const searchParams: PractitionerSearchParams = {};
    if (nationalId) {
      searchParams['nationalId'] = nationalId.value;
    } else if (licenseNo) {
      searchParams['licenseNumber'] = licenseNo.value;
    }
    if (refresh) {
      searchParams['refresh'] = refresh;
    }
    if (nationalId || licenseNo) {
      try {
        const practitioner = await searchPractitioner(searchParams, locationUuid);
        setPractitioner(practitioner);
        showSnackbar({
          kind: 'success',
          title: 'Successfully synced health worker records',
          subtitle: 'Successfully synced health worker records',
        });
        checkLicenseValidity(practitioner.licenses);
      } catch (error) {
        showSnackbar({
          kind: 'error',
          title: 'Error syncing health worker records',
          subtitle:
            error.message ??
            'An error occurred while syncing health worker details. Please Try again or contact support',
        });
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }
  function getProviderAttributes(provider) {
    const attributes = provider.attributes;
    const nationalId = attributes.find((attr) => {
      return attr.attributeType.display.trim().toLowerCase().includes('National Id'.toLowerCase().trim());
    });
    const licenseNo = attributes.find((attr) => {
      return attr.attributeType.display.trim().toLowerCase().includes('Licence Number'.toLowerCase().trim());
    });
    return {
      nationalId: nationalId,
      licenseNo: licenseNo,
    };
  }
  function getPractionerStatusType(status: string): TagType {
    if (status === 'Licensed') {
      return 'green';
    } else {
      return 'red';
    }
  }
  function onModalClose() {
    setDisplayDetailsModal(false);
  }
  function showDetailsModal() {
    setDisplayDetailsModal(true);
  }
  function syncHealthWorkerDetails() {
    getProviderDetails(true);
  }
  const isWithin30Days = (targetDate: string) => {
    const today = new Date().getMilliseconds();
    const target = new Date(targetDate).getMilliseconds();

    const diffInMs = target - today;
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

    return diffInMs > 0 && diffInMs <= thirtyDaysInMs;
  };
  const isExpired = (licenseEndDate: string): boolean => {
    return new Date(licenseEndDate).getTime() < new Date().getTime();
  };
  function checkLicenseValidity(practitionerLicenses: PractitionerLicense[]) {
    // check all licenses for a valid license
    const validLicense = practitionerLicenses.some((l) => {
      return !isExpired(l.license_end);
    });
    if (!validLicense) {
      // get the latest license
      const sortedExpiredLicenses = practitionerLicenses.sort((a, b) => {
        return new Date(b.license_end).getTime() - new Date(a.license_end).getTime();
      });
      if (sortedExpiredLicenses && sortedExpiredLicenses) {
        const latestExpiredLicense = sortedExpiredLicenses[0];
        showSnackbar({
          title: `Practioner Licence ${latestExpiredLicense.id} expired`,
          subtitle: `License ${latestExpiredLicense.id} (${latestExpiredLicense.license_type}) expired on ${latestExpiredLicense.license_end}. Kindly renew. `,
          kind: 'error',
        });
      }
    } else {
      //check current valid license if they are 30 days from expiry
      const nearExpiryLicensed = practitionerLicenses.filter((l) => {
        return new Date(l.license_end) > new Date() && isWithin30Days(l.license_end);
      });
      if (nearExpiryLicensed.length > 0) {
        const latestNearlyExpired = nearExpiryLicensed[0];
        showSnackbar({
          title: `Practioner Licence ${latestNearlyExpired.id} is almost expiring`,
          subtitle: `License ${latestNearlyExpired.id} (${latestNearlyExpired.license_type}) expires on ${latestNearlyExpired.license_end}. Kindly make plans to renew.`,
          kind: 'warning-alt',
        });
      }
    }
  }
  function getLatestLicense(): PractitionerLicense {
    if (!practitioner || !practitioner.licenses) {
      return null;
    }
    const sortedLicenses = practitioner.licenses.sort((a, b) => {
      return new Date(b.license_end).getTime() - new Date(a.license_end).getTime();
    });
    if (sortedLicenses.length) {
      return sortedLicenses[0];
    } else {
      return null;
    }
  }
  if (!practitioner) {
    return <></>;
  }
  return (
    <>
      <div className={styles.hwBannerLayout}>
        <div>
          <Tag className="some-class" size="md" title="Expiry" type="blue">
            Registration ID: {practitioner.membership.registration_id}
          </Tag>
        </div>
        {latestLicense ? (
          <>
            <div>
              <Tag className="some-class" size="md" title="Expiry" type="blue">
                License {latestLicense.id}
              </Tag>
            </div>
            <div>
              <Tag
                className="some-class"
                size="md"
                title="Expiry"
                type={getTagType(isExpired(latestLicense.license_end) ? 0 : 1)}
              >
                License Expiry {latestLicense.license_end}
              </Tag>
            </div>
          </>
        ) : (
          <></>
        )}
        <div>
          <Button size="sm" kind="tertiary" onClick={showDetailsModal}>
            View
          </Button>
        </div>
        <div>
          <Button size="sm" kind="secondary" onClick={syncHealthWorkerDetails}>
            {loading ? (
              <>
                <InlineLoading description="Syncing..." />
              </>
            ) : (
              <>Sync</>
            )}
          </Button>
        </div>
        {practitioner && displayDetailsModal ? (
          <>
            <HealthWorkerModal
              isModalOpen={displayDetailsModal}
              onRequestClose={onModalClose}
              selectedPractitioner={practitioner}
            />
          </>
        ) : (
          <></>
        )}
      </div>
    </>
  );
};
export default HealthWorkerBanner;
