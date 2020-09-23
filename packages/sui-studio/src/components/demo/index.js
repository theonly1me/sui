/* eslint react/no-multi-comp:0, no-console:0 */

import PropTypes from 'prop-types'
import React, {Component} from 'react'

import {iconClose, iconCode, iconFullScreen, iconFullScreenExit} from '../icons'
import Preview from '../preview'
import Style from '../style'

import {tryRequireCore as tryRequire} from '../tryRequire'
import stylesFor, {themesFor} from './fetch-styles'
import CodeEditor from './CodeEditor'
import ContextButtons from './ContextButtons'
import EventsButtons from './EventsButtons'
import ThemesButtons from './ThemesButtons'
import withContext from './HoC/withContext'

import SUIContext from '@s-ui/react-context'

import {
  createContextByType,
  isFunction,
  cleanDisplayName,
  pipe,
  removeDefaultContext
} from './utilities'

const EVIL_HACK_TO_RERENDER_AFTER_CHANGE = ' '
const CONTAINER_CLASS = 'sui-Studio'
const FULLSCREEN_CLASS = 'sui-Studio--fullscreen'

export default class Demo extends Component {
  state = {
    ctxt: false,
    ctxtSelectedIndex: 0,
    ctxtType: 'default',
    exports: false,
    isCodeOpen: false,
    isFullScreen: false,
    pkg: false,
    playground: undefined,
    theme: 'default',
    themes: [],
    themeSelectedIndex: 0
  }

  _init({category, component}) {
    // reset the components in order to show nothing in case
    // we're navigating to another component
    this.setState({
      exports: {default: null}
    })

    Promise.all([
      stylesFor({category, component}),
      tryRequire({category, component})
    ]).then(async ([style, requiredModules]) => {
      const [
        exports,
        playground,
        ctxt,
        events,
        pkg,
        DemoComponent
      ] = requiredModules
      const themes = themesFor({category, component})
      // context could be a Promise, and we should wait for it
      const context = isFunction(ctxt) ? await ctxt() : ctxt

      this.setState({
        ctxt: context,
        DemoComponent,
        events,
        exports,
        pkg,
        playground,
        style,
        themes
      })
    })
  }

  componentDidMount() {
    this._init(this.props.params)
  }

  // eslint-disable-next-line
  UNSAFE_componentWillReceiveProps(nextProps) {
    this._init(nextProps.params)
  }

  componentWillUnmount() {
    this.containerClassList && this.containerClassList.remove(FULLSCREEN_CLASS)
  }

  handleCode = () => {
    this.setState({isCodeOpen: !this.state.isCodeOpen})
  }

  handleFullScreen = () => {
    this.setState({isFullScreen: !this.state.isFullScreen}, () => {
      const {isFullScreen} = this.state
      this.containerClassList =
        this.containerClassList ||
        document.getElementsByClassName(CONTAINER_CLASS)[0].classList

      isFullScreen
        ? this.containerClassList.add(FULLSCREEN_CLASS)
        : this.containerClassList.remove(FULLSCREEN_CLASS)
    })
  }

  handleContextChange = (ctxtType, index) => {
    this.setState({
      ctxtType,
      ctxtSelectedIndex: index,
      playground: this.state.playground + EVIL_HACK_TO_RERENDER_AFTER_CHANGE
    })
  }

  handleThemeChange = (theme, index) => {
    const {category, component} = this.props.params
    stylesFor({category, component, withTheme: theme}).then(style => {
      this.setState({
        style,
        theme,
        themeSelectedIndex: index
      })
    })
  }

  render() {
    const {
      ctxt = {},
      ctxtSelectedIndex,
      ctxtType,
      DemoComponent,
      events,
      exports,
      isCodeOpen,
      isFullScreen,
      playground,
      style,
      themes,
      themeSelectedIndex
    } = this.state

    const {default: Base} = exports

    if (!Base) return null

    // check if is a normal component or it's wrapped with a React.memo method
    const ComponentToRender = Base.type ? Base.type : Base

    const nonDefaultExports = removeDefaultContext(exports)
    const context =
      Object.keys(ctxt).length && createContextByType(ctxt, ctxtType)
    const {domain} = context || {}

    const Enhance = pipe(withContext(context, context))(ComponentToRender)

    const EnhanceDemoComponent =
      DemoComponent && pipe(withContext(context, context))(DemoComponent)

    !Enhance.displayName &&
      console.error(new Error('Component.displayName must be defined.'))

    return (
      <div className="sui-StudioDemo">
        <Style>{style}</Style>
        <div className="sui-StudioNavBar-secondary">
          <ContextButtons
            ctxt={ctxt || {}}
            selected={ctxtSelectedIndex}
            onContextChange={this.handleContextChange}
          />
          <ThemesButtons
            themes={themes}
            selected={themeSelectedIndex}
            onThemeChange={this.handleThemeChange}
          />
          <EventsButtons events={events || {}} domain={domain} />
        </div>

        <button
          className="sui-StudioDemo-fullScreenButton"
          onClick={this.handleFullScreen}
        >
          {isFullScreen ? iconFullScreenExit : iconFullScreen}
        </button>

        {!EnhanceDemoComponent && playground && (
          <>
            <button
              className="sui-StudioDemo-codeButton"
              onClick={this.handleCode}
            >
              {isCodeOpen ? iconClose : iconCode}
            </button>

            {isCodeOpen && (
              <CodeEditor
                isOpen={isCodeOpen}
                onChange={playground => {
                  this.setState({playground})
                }}
                playground={playground}
              />
            )}

            <Preview
              code={playground}
              scope={{
                context,
                React,
                [cleanDisplayName(Enhance.displayName)]: Enhance,
                domain,
                ...nonDefaultExports
              }}
            />
          </>
        )}

        {EnhanceDemoComponent && (
          <SUIContext.Provider value={context}>
            <EnhanceDemoComponent />
          </SUIContext.Provider>
        )}
      </div>
    )
  }
}

Demo.propTypes = {
  category: PropTypes.string,
  component: PropTypes.string,
  params: PropTypes.shape({
    category: PropTypes.string,
    component: PropTypes.string
  })
}
