/* eslint-disable react/jsx-props-no-spreading */
import { useGetWebPropertyGroupedByEnv } from '@app/services/persistent';
import { useAddSsrSpaProperty, useValidateSsrSpaProperty } from '@app/services/ssr';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  Alert,
  Button,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Grid,
  GridItem,
  Split,
  SplitItem,
  TextInput,
  Tooltip
} from '@patternfly/react-core';
import { InfoCircleIcon, TimesCircleIcon } from '@patternfly/react-icons';
import { AxiosError } from 'axios';
import { useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import * as yup from 'yup';
import './workflow.css';

const schema = yup.object({
  name: yup.string().required().label('Application Name'),
  path: yup
    .string()
    .matches(/^[a-zA-Z0-9/-]+$/, 'Only letters, numbers, forward slash and dashes are allowed')
    .required(),
  contextDir: yup.string().required().label('Context Directory'),
  gitRef: yup.string().required().label('Branch'),
  type: yup.string().required().label('Repository Type'),
  ref: yup.string(),
  repoUrl: yup.string().trim().required().label('Repository URL'),
  env: yup.string().required().label('Environment'),
  healthCheckPath: yup
    .string()
    .matches(/^[a-zA-Z0-9/-]+$/, 'Only letters, numbers, forward slash and dashes are allowed')
    .required(),
  config: yup.array().of(
    yup.object({
      key: yup.string().trim().required().label('Configuration Key'),
      value: yup.string().trim().required().label('Configuration Value')
    })
  ),
  buildArgs: yup.array().of(
    yup.object({
      key: yup.string().trim().required().label('Key'),
      value: yup.string().trim().required().label('Value')
    })
  ),
  port: yup
    .string()
    .matches(/^\d+$/, { message: 'Port must contain only numbers', excludeEmptyString: true })
    .min(1, 'Port is required')
    .max(5, 'Port must be less than or equal to 5 digits')
    .test(
      'port',
      'Port must be less than or equal to 65536',
      (value) => parseInt(value as string, 10) <= 65536
    )
    .trim()
    .label('Port')
});

interface Props {
  onClose: () => void;
  propertyIdentifier: string;
  onSubmitWorkflow: (submit: boolean) => void;
}
export type FormData = yup.InferType<typeof schema>;
export const Workflow3 = ({
  onClose,
  propertyIdentifier,
  onSubmitWorkflow
}: Props): JSX.Element => {
  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    trigger,
    formState: { errors }
  } = useForm<FormData>({
    defaultValues: {
      healthCheckPath: '/',
      path: '/',
      gitRef: 'master',
      type: 'monolothic',
      port: '3000'
    },
    mode: 'onBlur',
    resolver: yupResolver(schema)
  });
  const [step, setStep] = useState<number>(1);
  const createSsrSpaProperty = useAddSsrSpaProperty(propertyIdentifier);
  const webProperties = useGetWebPropertyGroupedByEnv(propertyIdentifier);
  const webPropertiesKeys = Object.keys(webProperties.data || {});
  const [apiResponse, setApiResponse] = useState('3000');

  const validateSsrSpaProperty = useValidateSsrSpaProperty(propertyIdentifier);
  const [validateMessage, setValidateMessage] = useState('');

  const onSubmit = async (data: FormData) => {
    if (
      propertyIdentifier &&
      data.name &&
      data.repoUrl &&
      data.gitRef &&
      data.contextDir &&
      step === 2
    ) {
      const validateDTO = {
        propertyIdentifier,
        identifier: data.name,
        repoUrl: data.repoUrl,
        gitRef: data.gitRef,
        contextDir: data.contextDir
      };

      try {
        const response = await validateSsrSpaProperty.mutateAsync(validateDTO);

        setValidateMessage('');
        setApiResponse(response?.port);
      } catch (error) {
        if (error instanceof AxiosError && error.response && error.response.status === 403) {
          toast.error("You don't have access to perform this action");
        } else if (error instanceof AxiosError && error.response && error.response.status === 400) {
          toast.error(error.response.data.message);
          setValidateMessage(error.response.data.message);
        } else {
          toast.error('Failed to validate the containerized application');
        }
      }
    }

    if (step === 5) {
      const newdata = {
        ...data,
        path: data.path.trim().startsWith('/') ? data.path.trim() : `/${data.path.trim()}`,
        healthCheckPath: data.healthCheckPath.trim().startsWith('/')
          ? data.healthCheckPath.trim()
          : `/${data.healthCheckPath.trim()}`,
        config: data.config
          ? data.config.reduce((acc: Record<string, string>, cur: any) => {
              acc[cur.key.trim()] = cur.value.trim();
              return acc;
            }, {})
          : {},
        buildArgs: data.buildArgs
          ? data.buildArgs.reduce((acc: Record<string, string>, cur: any) => {
              acc[cur.key.trim()] = cur.value.trim();
              return acc;
            }, {})
          : {},
        propertyIdentifier: propertyIdentifier.trim(),
        port: apiResponse
      };

      onSubmitWorkflow(true);
      onClose();

      try {
        await createSsrSpaProperty.mutateAsync(newdata);
        onClose();
        toast.success('Deployed Containerized Application successfully');
      } catch (error) {
        if (error instanceof AxiosError && error.response && error.response.status === 403) {
          toast.error("You don't have access to perform this action");
          onClose();
        } else if (error instanceof AxiosError && error.response && error.response.status === 400) {
          toast.error(error.response.data.message);
        } else {
          toast.error('Failed to deploy containerized application');
        }
      }
    }
  };

  const handleNext = async () => {
    if (step === 2) {
      try {
        await handleSubmit(onSubmit)();

        if (validateMessage === '') {
          setStep(step + 1);
        }
      } catch (error) {
        console.error(error);
      }
    } else {
      try {
        const formErrors = await trigger();

        if (Object.keys(formErrors).length === 0) {
          setStep(step + 1);
        }
      } catch (error) {
        console.error(error);
      }
    }
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const {
    fields: configFields,
    append: appendConfig,
    remove: removeConfig
  } = useFieldArray({
    control,
    name: 'config'
  });

  const {
    fields: buildArgsFields,
    append: appendBuildArgs,
    remove: removeBuildArgs
  } = useFieldArray({
    control,
    name: 'buildArgs'
  });

  const handleAddConfig = () => {
    appendConfig({ key: '', value: '' });
  };

  const handleAddBuildArgs = () => {
    appendBuildArgs({ key: '', value: '' });
  };
  const handleClick = (stepNumber: number) => {
    setStep(stepNumber);
  };

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <Grid>
        <GridItem span={3}>
          <ul className="step-list">
            <li>
              <Button
                variant="link"
                onClick={() => handleClick(1)}
                style={{ color: step === 1 ? '#FDB716' : 'black' }}
              >
                <span
                  className="step-number"
                  style={{ backgroundColor: step === 1 ? '#FDB716' : '#ccc', color: '#000' }}
                >
                  1
                </span>
                Repository Details
              </Button>
            </li>
            <li>
              <Button
                variant="link"
                onClick={() => handleClick(2)}
                style={{ color: step === 2 ? '#FDB716' : 'black' }}
              >
                <span
                  className="step-number"
                  style={{ backgroundColor: step === 2 ? '#FDB716' : '#ccc', color: '#000' }}
                >
                  2
                </span>
                Application Details
              </Button>
            </li>
            <li>
              <Button
                variant="link"
                onClick={() => handleClick(3)}
                style={{ color: step === 3 ? '#FDB716' : 'black' }}
              >
                <span
                  className="step-number"
                  style={{ backgroundColor: step === 3 ? '#FDB716' : '#ccc', color: '#000' }}
                >
                  3
                </span>
                Deployment Config
              </Button>
            </li>
            <li>
              <Button
                variant="link"
                onClick={() => handleClick(4)}
                style={{ color: step === 4 ? '#FDB716' : 'black' }}
              >
                <span
                  className="step-number"
                  style={{ backgroundColor: step === 4 ? '#FDB716' : '#ccc', color: '#000' }}
                >
                  4
                </span>
                Build Arg
              </Button>
            </li>
            <li>
              <Button
                variant="link"
                onClick={() => handleClick(5)}
                style={{ color: step === 5 ? '#FDB716' : 'black' }}
              >
                <span
                  className="step-number"
                  style={{ backgroundColor: step === 5 ? '#FDB716' : '#ccc', color: '#000' }}
                >
                  5
                </span>
                Review
              </Button>
            </li>
          </ul>
        </GridItem>
        <GridItem span={9} style={{ borderLeft: '1px solid grey', paddingLeft: '20px' }}>
          {step === 1 && (
            <>
              <div>
                <Split hasGutter>
                  <SplitItem isFilled style={{ width: '100%' }}>
                    <Controller
                      control={control}
                      name="repoUrl"
                      render={({ field, fieldState: { error } }) => (
                        <FormGroup
                          style={{ color: '#000' }}
                          label={
                            <>
                              Repository URL
                              <Tooltip
                                content={
                                  <div>
                                    The registry URL of the application you want to deploy. for
                                    example, Sample URL : quay.io/spaship/sample-ssr-app
                                  </div>
                                }
                              >
                                <span>
                                  &nbsp; <InfoCircleIcon style={{ color: '#6A6E73' }} />
                                </span>
                              </Tooltip>
                            </>
                          }
                          isRequired
                          fieldId="repoUrl"
                          validated={error ? 'error' : 'default'}
                          helperTextInvalid={error?.message}
                        >
                          <TextInput
                            isRequired
                            placeholder="Enter Repository URL"
                            type="text"
                            id="repoUrl"
                            {...field}
                          />
                        </FormGroup>
                      )}
                    />
                  </SplitItem>
                </Split>
                <Split hasGutter>
                  <SplitItem isFilled style={{ width: '100%' }} className="pf-u-mr-md pf-u-mt-lg">
                    <Controller
                      control={control}
                      name="contextDir"
                      render={({ field, fieldState: { error } }) => (
                        <FormGroup
                          style={{ color: '#000' }}
                          label={
                            <>
                              Context Directory
                              <Tooltip
                                content={
                                  <div>
                                    The registry URL of the application you want to deploy. for
                                    example, Sample URL : quay.io/spaship/sample-ssr-app
                                  </div>
                                }
                              >
                                <span>
                                  &nbsp; <InfoCircleIcon style={{ color: '#6A6E73' }} />
                                </span>
                              </Tooltip>
                            </>
                          }
                          isRequired
                          fieldId="contextDir"
                          validated={error ? 'error' : 'default'}
                          helperTextInvalid={error?.message}
                        >
                          <TextInput
                            isRequired
                            placeholder="Enter Context Directory"
                            type="text"
                            id="contextDir"
                            {...field}
                          />
                        </FormGroup>
                      )}
                    />
                  </SplitItem>
                </Split>
                <Split hasGutter>
                  <SplitItem isFilled style={{ width: '100%' }} className="pf-u-mr-md pf-u-mt-lg">
                    <Controller
                      control={control}
                      name="type"
                      render={({ field, fieldState: { error } }) => (
                        <FormGroup
                          style={{ color: '#000' }}
                          label="Repository Type"
                          isRequired
                          fieldId="type"
                          validated={error ? 'error' : 'default'}
                          helperTextInvalid={error?.message}
                        >
                          <TextInput
                            isRequired
                            placeholder="Enter Repository type"
                            type="text"
                            id="type"
                            {...field}
                          />
                        </FormGroup>
                      )}
                    />
                  </SplitItem>
                  <SplitItem isFilled style={{ width: '100%' }} className="pf-u-mr-md pf-u-mt-lg">
                    <Controller
                      control={control}
                      name="gitRef"
                      render={({ field, fieldState: { error } }) => (
                        <FormGroup
                          style={{ color: '#000' }}
                          label="Git Branch"
                          fieldId="gitRef"
                          validated={error ? 'error' : 'default'}
                          helperTextInvalid={error?.message}
                        >
                          <TextInput placeholder="Git Branch" type="text" id="branch" {...field} />
                        </FormGroup>
                      )}
                    />
                  </SplitItem>
                </Split>
              </div>
              <div style={{ bottom: '0px', position: 'absolute', width: '100%' }}>
                <Button
                  variant="primary"
                  type="button"
                  onClick={handleNext}
                  style={{ margin: '10px 10px 10px 0px' }}
                >
                  Next
                </Button>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <div>
                <Split hasGutter>
                  <SplitItem isFilled style={{ width: '100%' }}>
                    <Controller
                      control={control}
                      name="name"
                      render={({ field, fieldState: { error } }) => (
                        <FormGroup
                          label="Application Name"
                          isRequired
                          fieldId="property-name"
                          validated={error ? 'error' : 'default'}
                          helperTextInvalid={error?.message}
                        >
                          <TextInput
                            isRequired
                            placeholder="Application Name"
                            type="text"
                            id="property-name"
                            {...field}
                          />
                        </FormGroup>
                      )}
                    />
                  </SplitItem>
                  <SplitItem isFilled style={{ width: '100%' }}>
                    <Controller
                      control={control}
                      name="env"
                      render={({ field: { onChange, value }, fieldState: { error } }) => (
                        <FormGroup
                          label="Select Environment"
                          fieldId="select-env"
                          validated={error ? 'error' : 'default'}
                          isRequired
                          helperTextInvalid={error?.message}
                        >
                          <FormSelect
                            label="Select Environment"
                            aria-label="FormSelect Input"
                            onChange={(event) => {
                              onChange(event);
                            }}
                            value={value}
                          >
                            <FormSelectOption key={1} label="Please select an environment" />
                            {webPropertiesKeys.map((envName) => (
                              <FormSelectOption key={envName} value={envName} label={envName} />
                            ))}
                          </FormSelect>
                        </FormGroup>
                      )}
                    />
                  </SplitItem>
                </Split>
                <Split hasGutter>
                  <SplitItem isFilled style={{ width: '100%' }} className="pf-u-mr-md pf-u-mt-lg">
                    <Controller
                      control={control}
                      name="path"
                      rules={{ required: 'Path is required' }}
                      render={({ field, fieldState: { error } }) => {
                        const handleChange = (e: string) => {
                          const pathValue = e;
                          const healthCheckPathValue = getValues('healthCheckPath');
                          if (healthCheckPathValue === field.value) {
                            setValue('healthCheckPath', pathValue);
                            trigger('healthCheckPath');
                          }
                          field.onChange(e);
                        };
                        return (
                          <FormGroup
                            style={{ color: '#000' }}
                            label={
                              <>
                                Path
                                <Tooltip
                                  content={
                                    <div>
                                      This will be the context path is your application.
                                      <br /> Please note that this should match the homepage
                                      attribute of the package.json file.
                                    </div>
                                  }
                                >
                                  <span>
                                    &nbsp; <InfoCircleIcon style={{ color: '#6A6E73' }} />
                                  </span>
                                </Tooltip>
                              </>
                            }
                            isRequired
                            fieldId="path"
                            validated={error ? 'error' : 'default'}
                            helperTextInvalid={error?.message}
                          >
                            <TextInput
                              isRequired
                              placeholder="Path"
                              type="text"
                              id="path"
                              value={field.value}
                              onChange={handleChange}
                              onBlur={() => trigger('path')}
                              style={{ marginRight: '0px' }}
                            />
                          </FormGroup>
                        );
                      }}
                    />
                  </SplitItem>
                  <SplitItem isFilled style={{ width: '100%' }} className="pf-u-mr-md pf-u-mt-lg">
                    <Controller
                      control={control}
                      name="healthCheckPath"
                      rules={{ required: 'Health Check Path is required' }}
                      render={({ field, fieldState: { error } }) => (
                        <FormGroup
                          style={{ color: '#000' }}
                          label={
                            <>
                              Health Check Path
                              <Tooltip
                                content={
                                  <div>
                                    By default, it will pick the value of the Path attribute, used
                                    for application liveness checking for monitoring and auto
                                    redeployment on failure.
                                  </div>
                                }
                              >
                                <span>
                                  &nbsp; <InfoCircleIcon style={{ color: '#6A6E73' }} />
                                </span>
                              </Tooltip>
                            </>
                          }
                          isRequired
                          fieldId="healthCheckPath"
                          validated={error ? 'error' : 'default'}
                          helperTextInvalid={error?.message}
                        >
                          <TextInput
                            isRequired
                            placeholder="Enter health Check Path"
                            type="text"
                            id="healthCheckPath"
                            {...field}
                            onBlur={() => trigger('healthCheckPath')}
                            style={{ marginRight: '0px' }}
                          />
                        </FormGroup>
                      )}
                    />
                  </SplitItem>
                </Split>
                <Split hasGutter>
                  <SplitItem isFilled style={{ width: '100%' }} className="pf-u-mr-md pf-u-mt-lg">
                    <Controller
                      control={control}
                      name="ref"
                      render={({ field, fieldState: { error } }) => (
                        <FormGroup
                          style={{ color: '#000' }}
                          label="Ref"
                          fieldId="ref"
                          validated={error ? 'error' : 'default'}
                          helperTextInvalid={error?.message}
                        >
                          <TextInput placeholder="Ref" type="text" id="ref" {...field} />
                        </FormGroup>
                      )}
                    />
                  </SplitItem>
                  <SplitItem isFilled style={{ width: '100%' }} className="pf-u-mr-md pf-u-mt-lg">
                    <Controller
                      control={control}
                      name="port"
                      render={({ field, fieldState: { error } }) => (
                        <FormGroup
                          label={
                            <>
                              Port
                              <Tooltip content={<div>Kindly put port for your application.</div>}>
                                <span>
                                  &nbsp; <InfoCircleIcon style={{ color: '#6A6E73' }} />
                                </span>
                              </Tooltip>
                            </>
                          }
                          isRequired
                          fieldId="port"
                          validated={error ? 'error' : 'default'}
                          helperTextInvalid={error?.message}
                        >
                          <TextInput
                            isRequired
                            placeholder="Enter port"
                            type="text"
                            id="port"
                            {...field}
                            value={apiResponse}
                          />
                        </FormGroup>
                      )}
                    />
                  </SplitItem>
                </Split>
              </div>
              {validateMessage !== '' && (
                <Alert
                  variant="danger"
                  isInline
                  title={validateMessage}
                  timeout={5000}
                  className="pf-u-mt-lg"
                />
              )}

              <div style={{ bottom: '0px', position: 'absolute', width: '100%' }}>
                <Button
                  variant="primary"
                  type="button"
                  onClick={handleBack}
                  style={{ margin: '10px 10px 10px 0px' }}
                >
                  Back
                </Button>
                <Button
                  variant="primary"
                  type="button"
                  onClick={handleNext}
                  style={{ margin: '10px 10px 10px 0px' }}
                >
                  Next
                </Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <div className="form-header">
                  Configuration
                  <Tooltip
                    content={
                      <div>
                        This will store the configuration map in key-value pairs, which will be
                        required during the application runtime, for example, if your app reads a
                        value of some env variable to configure itself during start-up.
                      </div>
                    }
                  >
                    <span style={{ marginLeft: '5px' }}>
                      <InfoCircleIcon style={{ color: '#6A6E73' }} />
                    </span>
                  </Tooltip>
                </div>
                <Split hasGutter>
                  <SplitItem
                    isFilled
                    style={{
                      display: 'grid',
                      justifyContent: 'right'
                    }}
                  >
                    <Button variant="link" style={{ color: '#6A6E73' }} onClick={handleAddConfig}>
                      Add Key Value
                    </Button>
                  </SplitItem>
                </Split>
                {configFields.map((pair, index) => (
                  <Split key={`key-${index + 1}`} hasGutter>
                    <SplitItem key={`key-${index + 1}`} isFilled className="pf-u-mr-md pf-u-mb-lg">
                      <Controller
                        control={control}
                        name={`config.${index}.key`}
                        defaultValue={pair.key}
                        render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                          <FormGroup
                            label="Key"
                            fieldId={`key-${index}`}
                            validated={error ? 'error' : 'default'}
                            helperTextInvalid={error?.message}
                          >
                            <TextInput
                              id={`key-${index}`}
                              type="text"
                              placeholder="Configuration Key"
                              value={value}
                              onChange={(event) => {
                                onChange(event);
                              }}
                              onBlur={onBlur}
                            />
                          </FormGroup>
                        )}
                      />
                    </SplitItem>
                    <SplitItem
                      key={`value-${index + 1}`}
                      isFilled
                      className="pf-u-mr-md pf-u-mb-lg"
                    >
                      <Controller
                        control={control}
                        name={`config.${index}.value`}
                        defaultValue={pair.value}
                        render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                          <FormGroup
                            label="Value"
                            fieldId={`value-${index}`}
                            validated={error ? 'error' : 'default'}
                            helperTextInvalid={error?.message}
                          >
                            <TextInput
                              id={`value-${index}`}
                              type="text"
                              placeholder="Configuration Value"
                              value={value}
                              onChange={(event) => {
                                onChange(event);
                              }}
                              onBlur={onBlur}
                            />
                          </FormGroup>
                        )}
                      />
                    </SplitItem>
                    <SplitItem
                      key={`remove-${index + 1}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginLeft: 'var(--pf-global--spacer--md)',
                        marginTop: 'var(--pf-global--spacer--lg)'
                      }}
                    >
                      <Button
                        variant="link"
                        icon={<TimesCircleIcon />}
                        onClick={() => removeConfig(index)}
                      />
                    </SplitItem>
                  </Split>
                ))}
              </div>
              <div style={{ bottom: '0px', position: 'absolute', width: '100%' }}>
                <Button
                  variant="primary"
                  type="button"
                  onClick={handleBack}
                  style={{ margin: '10px 10px 10px 0px' }}
                >
                  Back
                </Button>
                <Button
                  variant="primary"
                  type="button"
                  onClick={handleNext}
                  style={{ margin: '10px 10px 10px 0px' }}
                >
                  Next
                </Button>
              </div>
            </>
          )}
          {step === 4 && (
            <>
              <div>
                <div className="form-header">
                  Build Arugments
                  <Tooltip
                    content={
                      <div>
                        This will store the configuration map in key-value pairs, which will be
                        required during the application runtime, for example, if your app reads a
                        value of some env variable to configure itself during start-up.
                      </div>
                    }
                  >
                    <span style={{ marginLeft: '5px' }}>
                      <InfoCircleIcon style={{ color: '#6A6E73' }} />
                    </span>
                  </Tooltip>
                </div>
                <Split hasGutter>
                  <SplitItem
                    isFilled
                    style={{
                      display: 'grid',
                      justifyContent: 'right'
                    }}
                  >
                    <Button
                      variant="link"
                      style={{ color: '#6A6E73' }}
                      onClick={handleAddBuildArgs}
                    >
                      Add Key Value
                    </Button>
                  </SplitItem>
                </Split>
                {buildArgsFields.map((pair, index) => (
                  <Split key={`buildArgskey-${index + 1}`} hasGutter>
                    <SplitItem
                      key={`buildArgskey-${index + 1}`}
                      isFilled
                      className="pf-u-mr-md pf-u-mb-lg"
                    >
                      <Controller
                        control={control}
                        name={`buildArgs.${index}.key`}
                        defaultValue={pair.key}
                        render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                          <FormGroup
                            label="Key"
                            fieldId={`buildArgskey-${index}`}
                            validated={error ? 'error' : 'default'}
                            helperTextInvalid={error?.message}
                          >
                            <TextInput
                              id={`buildArgskey-${index}`}
                              type="text"
                              placeholder="Key"
                              value={value}
                              onChange={(event) => {
                                onChange(event);
                              }}
                              onBlur={onBlur}
                            />
                          </FormGroup>
                        )}
                      />
                    </SplitItem>
                    <SplitItem
                      key={`buildArgsvalue-${index + 1}`}
                      isFilled
                      className="pf-u-mr-md pf-u-mb-lg"
                    >
                      <Controller
                        control={control}
                        name={`buildArgs.${index}.value`}
                        defaultValue={pair.value}
                        render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                          <FormGroup
                            label="Value"
                            fieldId={`buildArgsvalue-${index}`}
                            validated={error ? 'error' : 'default'}
                            helperTextInvalid={error?.message}
                          >
                            <TextInput
                              id={`buildArgsvalue-${index}`}
                              type="text"
                              placeholder="Value"
                              value={value}
                              onChange={(event) => {
                                onChange(event);
                              }}
                              onBlur={onBlur}
                            />
                          </FormGroup>
                        )}
                      />
                    </SplitItem>
                    <SplitItem
                      key={`buildArgsremove-${index + 1}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginLeft: 'var(--pf-global--spacer--md)',
                        marginTop: 'var(--pf-global--spacer--lg)'
                      }}
                    >
                      <Button
                        variant="link"
                        icon={<TimesCircleIcon />}
                        onClick={() => removeBuildArgs(index)}
                      />
                    </SplitItem>
                  </Split>
                ))}
              </div>
              <div style={{ bottom: '0px', position: 'absolute', width: '100%' }}>
                <Button
                  variant="primary"
                  type="button"
                  onClick={handleBack}
                  style={{ margin: '10px 10px 10px 0px' }}
                >
                  Back
                </Button>
                <Button
                  variant="primary"
                  type="button"
                  onClick={handleNext}
                  style={{ margin: '10px 10px 10px 0px' }}
                >
                  Next
                </Button>
              </div>
            </>
          )}
          {step === 5 && (
            <>
              <div>
                <Split hasGutter>
                  <SplitItem isFilled style={{ width: '100%' }}>
                    <Controller
                      control={control}
                      name="repoUrl"
                      render={({ field, fieldState: { error } }) => (
                        <FormGroup
                          style={{ color: '#000' }}
                          label={
                            <>
                              Repository URL
                              <Tooltip
                                content={
                                  <div>
                                    The registry URL of the application you want to deploy. for
                                    example, Sample URL : quay.io/spaship/sample-ssr-app
                                  </div>
                                }
                              >
                                <span>
                                  &nbsp; <InfoCircleIcon style={{ color: '#6A6E73' }} />
                                </span>
                              </Tooltip>
                            </>
                          }
                          isRequired
                          fieldId="repoUrl"
                          validated={error ? 'error' : 'default'}
                          helperTextInvalid={error?.message}
                        >
                          <TextInput
                            isRequired
                            placeholder="Enter Repository URL"
                            type="text"
                            id="repoUrl"
                            {...field}
                            isDisabled
                          />
                        </FormGroup>
                      )}
                    />
                  </SplitItem>
                </Split>
                <Split hasGutter>
                  <SplitItem isFilled style={{ width: '100%' }} className="pf-u-mr-md pf-u-mt-lg">
                    <Controller
                      control={control}
                      name="contextDir"
                      render={({ field, fieldState: { error } }) => (
                        <FormGroup
                          style={{ color: '#000' }}
                          label={
                            <>
                              Context Directory
                              <Tooltip
                                content={
                                  <div>
                                    The registry URL of the application you want to deploy. for
                                    example, Sample URL : quay.io/spaship/sample-ssr-app
                                  </div>
                                }
                              >
                                <span>
                                  &nbsp; <InfoCircleIcon style={{ color: '#6A6E73' }} />
                                </span>
                              </Tooltip>
                            </>
                          }
                          isRequired
                          fieldId="contextDir"
                          validated={error ? 'error' : 'default'}
                          helperTextInvalid={error?.message}
                        >
                          <TextInput
                            isRequired
                            placeholder="Enter Context Directory"
                            type="text"
                            id="contextDir"
                            {...field}
                            isDisabled
                          />
                        </FormGroup>
                      )}
                    />
                  </SplitItem>
                </Split>
                <Split hasGutter>
                  <SplitItem isFilled style={{ width: '100%' }} className="pf-u-mr-md pf-u-mt-lg">
                    <Controller
                      control={control}
                      name="type"
                      render={({ field, fieldState: { error } }) => (
                        <FormGroup
                          style={{ color: '#000' }}
                          label="Repository Type"
                          isRequired
                          fieldId="type"
                          validated={error ? 'error' : 'default'}
                          helperTextInvalid={error?.message}
                        >
                          <TextInput
                            isRequired
                            placeholder="Enter Repository type"
                            type="text"
                            id="type"
                            {...field}
                            isDisabled
                          />
                        </FormGroup>
                      )}
                    />
                  </SplitItem>
                  <SplitItem isFilled style={{ width: '100%' }} className="pf-u-mr-md pf-u-mt-lg">
                    <Controller
                      control={control}
                      name="gitRef"
                      render={({ field, fieldState: { error } }) => (
                        <FormGroup
                          style={{ color: '#000' }}
                          label="Git Branch"
                          fieldId="gitRef"
                          validated={error ? 'error' : 'default'}
                          helperTextInvalid={error?.message}
                        >
                          <TextInput
                            placeholder="Git Branch"
                            type="text"
                            id="branch"
                            {...field}
                            isDisabled
                          />
                        </FormGroup>
                      )}
                    />
                  </SplitItem>
                </Split>
                <Split hasGutter>
                  <SplitItem isFilled style={{ width: '100%' }} className="pf-u-mr-md pf-u-mt-lg">
                    <Controller
                      control={control}
                      name="name"
                      render={({ field, fieldState: { error } }) => (
                        <FormGroup
                          label="Application Name"
                          isRequired
                          fieldId="property-name"
                          validated={error ? 'error' : 'default'}
                          helperTextInvalid={error?.message}
                        >
                          <TextInput
                            isRequired
                            placeholder="Application Name"
                            type="text"
                            id="property-name"
                            {...field}
                            isDisabled
                          />
                        </FormGroup>
                      )}
                    />
                  </SplitItem>
                  <SplitItem isFilled style={{ width: '100%' }} className="pf-u-mr-md pf-u-mt-lg">
                    <Controller
                      control={control}
                      name="env"
                      render={({ field, fieldState: { error } }) => (
                        <FormGroup
                          label="Select Environment"
                          fieldId="select-env"
                          validated={error ? 'error' : 'default'}
                          isRequired
                          helperTextInvalid={error?.message}
                        >
                          <TextInput
                            isRequired
                            placeholder="Environment"
                            type="text"
                            id="path"
                            {...field}
                            style={{ marginRight: '0px' }}
                            isDisabled
                          />
                        </FormGroup>
                      )}
                    />
                  </SplitItem>
                </Split>
                <Split hasGutter>
                  <SplitItem isFilled style={{ width: '100%' }} className="pf-u-mr-md pf-u-mt-lg">
                    <Controller
                      control={control}
                      name="path"
                      rules={{ required: 'Path is required' }}
                      render={({ field, fieldState: { error } }) => {
                        const handleChange = (e: string) => {
                          const pathValue = e;
                          const healthCheckPathValue = getValues('healthCheckPath');
                          if (healthCheckPathValue === field.value) {
                            setValue('healthCheckPath', pathValue);
                            trigger('healthCheckPath');
                          }
                          field.onChange(e);
                        };
                        return (
                          <FormGroup
                            style={{ color: '#000' }}
                            label={
                              <>
                                Path
                                <Tooltip
                                  content={
                                    <div>
                                      This will be the context path is your application.
                                      <br /> Please note that this should match the homepage
                                      attribute of the package.json file.
                                    </div>
                                  }
                                >
                                  <span>
                                    &nbsp; <InfoCircleIcon style={{ color: '#6A6E73' }} />
                                  </span>
                                </Tooltip>
                              </>
                            }
                            isRequired
                            fieldId="path"
                            validated={error ? 'error' : 'default'}
                            helperTextInvalid={error?.message}
                          >
                            <TextInput
                              isRequired
                              placeholder="Path"
                              type="text"
                              id="path"
                              value={field.value}
                              onChange={handleChange}
                              onBlur={() => trigger('path')}
                              style={{ marginRight: '0px' }}
                              isDisabled
                            />
                          </FormGroup>
                        );
                      }}
                    />
                  </SplitItem>
                  <SplitItem isFilled style={{ width: '100%' }} className="pf-u-mr-md pf-u-mt-lg">
                    <Controller
                      control={control}
                      name="healthCheckPath"
                      rules={{ required: 'Health Check Path is required' }}
                      render={({ field, fieldState: { error } }) => (
                        <FormGroup
                          style={{ color: '#000' }}
                          label={
                            <>
                              Health Check Path
                              <Tooltip
                                content={
                                  <div>
                                    By default, it will pick the value of the Path attribute, used
                                    for application liveness checking for monitoring and auto
                                    redeployment on failure.
                                  </div>
                                }
                              >
                                <span>
                                  &nbsp; <InfoCircleIcon style={{ color: '#6A6E73' }} />
                                </span>
                              </Tooltip>
                            </>
                          }
                          isRequired
                          fieldId="healthCheckPath"
                          validated={error ? 'error' : 'default'}
                          helperTextInvalid={error?.message}
                        >
                          <TextInput
                            isRequired
                            placeholder="Enter health Check Path"
                            type="text"
                            id="healthCheckPath"
                            {...field}
                            isDisabled
                            onBlur={() => trigger('healthCheckPath')}
                            style={{ marginRight: '0px' }}
                          />
                        </FormGroup>
                      )}
                    />
                  </SplitItem>
                </Split>
                <Split hasGutter>
                  <SplitItem isFilled style={{ width: '100%' }} className="pf-u-mr-md pf-u-mt-lg">
                    <Controller
                      control={control}
                      name="ref"
                      render={({ field, fieldState: { error } }) => (
                        <FormGroup
                          style={{ color: '#000' }}
                          label="Ref"
                          fieldId="ref"
                          validated={error ? 'error' : 'default'}
                          helperTextInvalid={error?.message}
                        >
                          <TextInput placeholder="Ref" type="text" id="ref" {...field} isDisabled />
                        </FormGroup>
                      )}
                    />
                  </SplitItem>
                  <SplitItem isFilled style={{ width: '100%' }} className="pf-u-mr-md pf-u-mt-lg">
                    <Controller
                      control={control}
                      name="port"
                      render={({ field, fieldState: { error } }) => (
                        <FormGroup
                          label={
                            <>
                              Port
                              <Tooltip content={<div>Kindly put port for your application.</div>}>
                                <span>
                                  &nbsp; <InfoCircleIcon style={{ color: '#6A6E73' }} />
                                </span>
                              </Tooltip>
                            </>
                          }
                          isRequired
                          fieldId="port"
                          validated={error ? 'error' : 'default'}
                          helperTextInvalid={error?.message}
                        >
                          <TextInput
                            isRequired
                            placeholder="Enter port"
                            type="text"
                            id="port"
                            {...field}
                            isDisabled
                            value={apiResponse}
                          />
                        </FormGroup>
                      )}
                    />
                  </SplitItem>
                </Split>

                {configFields.length !== 0 && (
                  <Split hasGutter>
                    <div className="form-header">
                      Configuration
                      <Tooltip
                        content={
                          <div>
                            This will store the configuration map in key-value pairs, which will be
                            required during the application runtime, for example, if your app reads
                            a value of some env variable to configure itself during start-up.
                          </div>
                        }
                      >
                        <span style={{ marginLeft: '5px' }}>
                          <InfoCircleIcon style={{ color: '#6A6E73' }} />
                        </span>
                      </Tooltip>
                    </div>
                  </Split>
                )}
                {configFields &&
                  configFields.map((pair, index) => (
                    <Split key={`key-${index + 1}`} hasGutter>
                      <SplitItem
                        key={`key-${index + 1}`}
                        isFilled
                        className="pf-u-mr-md pf-u-mb-lg"
                      >
                        <Controller
                          control={control}
                          name={`config.${index}.key`}
                          defaultValue={pair.key}
                          render={({
                            field: { onChange, onBlur, value },
                            fieldState: { error }
                          }) => (
                            <FormGroup
                              label="Key"
                              fieldId={`key-${index}`}
                              validated={error ? 'error' : 'default'}
                              helperTextInvalid={error?.message}
                            >
                              <TextInput
                                id={`key-${index}`}
                                type="text"
                                placeholder="Configuration Key"
                                value={value}
                                onChange={(event) => {
                                  onChange(event);
                                }}
                                onBlur={onBlur}
                                isDisabled
                              />
                            </FormGroup>
                          )}
                        />
                      </SplitItem>
                      <SplitItem
                        key={`value-${index + 1}`}
                        isFilled
                        className="pf-u-mr-md pf-u-mb-lg"
                      >
                        <Controller
                          control={control}
                          name={`config.${index}.value`}
                          defaultValue={pair.value}
                          render={({
                            field: { onChange, onBlur, value },
                            fieldState: { error }
                          }) => (
                            <FormGroup
                              label="Value"
                              fieldId={`value-${index}`}
                              validated={error ? 'error' : 'default'}
                              helperTextInvalid={error?.message}
                            >
                              <TextInput
                                id={`value-${index}`}
                                type="text"
                                placeholder="Configuration Value"
                                value={value}
                                onChange={(event) => {
                                  onChange(event);
                                }}
                                onBlur={onBlur}
                                isDisabled
                              />
                            </FormGroup>
                          )}
                        />
                      </SplitItem>
                    </Split>
                  ))}

                {buildArgsFields.length !== 0 && (
                  <Split hasGutter>
                    <div className="form-header">
                      Build Arugments
                      <Tooltip
                        content={
                          <div>
                            This will store the configuration map in key-value pairs, which will be
                            required during the application runtime, for example, if your app reads
                            a value of some env variable to configure itself during start-up.
                          </div>
                        }
                      >
                        <span style={{ marginLeft: '5px' }}>
                          <InfoCircleIcon style={{ color: '#6A6E73' }} />
                        </span>
                      </Tooltip>
                    </div>
                  </Split>
                )}
                {buildArgsFields.map((pair, index) => (
                  <Split key={`buildArgskey-${index + 1}`} hasGutter>
                    <SplitItem
                      key={`buildArgskey-${index + 1}`}
                      isFilled
                      className="pf-u-mr-md pf-u-mb-lg"
                    >
                      <Controller
                        control={control}
                        name={`buildArgs.${index}.key`}
                        defaultValue={pair.key}
                        render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                          <FormGroup
                            label="Key"
                            fieldId={`buildArgskey-${index}`}
                            validated={error ? 'error' : 'default'}
                            helperTextInvalid={error?.message}
                          >
                            <TextInput
                              id={`buildArgskey-${index}`}
                              type="text"
                              placeholder="Key"
                              value={value}
                              onChange={(event) => {
                                onChange(event);
                              }}
                              onBlur={onBlur}
                              isDisabled
                            />
                          </FormGroup>
                        )}
                      />
                    </SplitItem>
                    <SplitItem
                      key={`buildArgsvalue-${index + 1}`}
                      isFilled
                      className="pf-u-mr-md pf-u-mb-lg"
                    >
                      <Controller
                        control={control}
                        name={`buildArgs.${index}.value`}
                        defaultValue={pair.value}
                        render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                          <FormGroup
                            label="Value"
                            fieldId={`buildArgsvalue-${index}`}
                            validated={error ? 'error' : 'default'}
                            helperTextInvalid={error?.message}
                          >
                            <TextInput
                              id={`buildArgsvalue-${index}`}
                              type="text"
                              placeholder="Value"
                              value={value}
                              onChange={(event) => {
                                onChange(event);
                              }}
                              onBlur={onBlur}
                              isDisabled
                            />
                          </FormGroup>
                        )}
                      />
                    </SplitItem>
                  </Split>
                ))}
              </div>
              <Button
                variant="primary"
                type="button"
                onClick={handleBack}
                style={{ margin: '10px 10px 10px 0px' }}
              >
                Back
              </Button>
              <Button variant="primary" type="submit" isDisabled={Object.keys(errors).length > 0}>
                Finish
              </Button>
            </>
          )}
        </GridItem>
      </Grid>
    </Form>
  );
};